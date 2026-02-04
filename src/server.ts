import { Hono } from "hono";
import { createHash } from "node:crypto";
import type { Config } from "./types";
import { authenticateDevice } from "./auth";
import { GitHubClient } from "./github/client";
import { CacheManager } from "./github/cache";
import { AssetSigner } from "./github/signing";
import { AuditLogger } from "./audit/logger";
import { RateLimiter } from "./middleware/ratelimit";

export function createServer(config: Config): Hono {
  const app = new Hono();

  const githubClient = new GitHubClient(config.github.token);
  const cacheManager = new CacheManager(
    config.github.cache_dir,
    config.github.cache_ttl_seconds,
  );
  const auditLogger = new AuditLogger(config.audit?.log_file);
  const rateLimiter = new RateLimiter(60);

  let assetSigner: AssetSigner | null = null;
  if (config.signing?.enabled && config.signing?.private_key_path) {
    try {
      assetSigner = new AssetSigner(config.signing.private_key_path);
    } catch {
      console.warn("Failed to load signing key");
    }
  }

  function getAuthConfig(): Record<string, unknown> | undefined {
    if (config.auth.method === "jamf") {
      return config.auth.jamf;
    }
    if (config.auth.method === "tailscale") {
      return config.auth.tailscale;
    }
    if (config.auth.method === "mtls") {
      return config.auth.mtls;
    }
    return undefined;
  }

  app.get("/health", (c) => {
    return c.json({ status: "ok", timestamp: Date.now() });
  });

  app.get("/releases/:owner/:repo", async (c) => {
    const owner = c.req.param("owner");
    const repo = c.req.param("repo");
    const headers = Object.fromEntries(c.req.raw.headers);

    const device = await authenticateDevice(
      config.auth.method,
      headers,
      undefined,
      getAuthConfig(),
    );

    if (!device) {
      auditLogger.logAction(
        "unknown",
        "list_releases",
        `${owner}/${repo}`,
        "failure",
      );
      return c.json({ error: "Unauthorized" }, 401);
    }

    if (!rateLimiter.isAllowed(device.device_id)) {
      auditLogger.logAction(
        device.device_id,
        "list_releases",
        `${owner}/${repo}`,
        "failure",
        { reason: "rate_limited" },
      );
      return c.json({ error: "Rate limited" }, 429);
    }

    const cacheKey = `releases:${owner}:${repo}`;
    const cached = cacheManager.get(cacheKey);

    if (cached) {
      auditLogger.logAction(
        device.device_id,
        "list_releases",
        `${owner}/${repo}`,
        "success",
        { cached: true },
      );
      return c.json(JSON.parse(cached.toString("utf-8")));
    }

    const releases = await githubClient.listReleases(owner, repo);

    if (releases.length === 0) {
      auditLogger.logAction(
        device.device_id,
        "list_releases",
        `${owner}/${repo}`,
        "failure",
        { reason: "not_found" },
      );
      return c.json({ error: "Repository not found" }, 404);
    }

    const data = Buffer.from(JSON.stringify(releases));
    cacheManager.set(cacheKey, data);

    auditLogger.logAction(
      device.device_id,
      "list_releases",
      `${owner}/${repo}`,
      "success",
    );
    return c.json(releases);
  });

  app.get("/release/:owner/:repo/:version/:asset", async (c) => {
    const owner = c.req.param("owner");
    const repo = c.req.param("repo");
    const version = c.req.param("version");
    const assetName = c.req.param("asset");
    const headers = Object.fromEntries(c.req.raw.headers);

    const device = await authenticateDevice(
      config.auth.method,
      headers,
      undefined,
      getAuthConfig(),
    );

    if (!device) {
      auditLogger.logAction(
        "unknown",
        "download_asset",
        `${owner}/${repo}/${version}/${assetName}`,
        "failure",
      );
      return c.json({ error: "Unauthorized" }, 401);
    }

    if (!rateLimiter.isAllowed(device.device_id)) {
      auditLogger.logAction(
        device.device_id,
        "download_asset",
        `${owner}/${repo}/${version}/${assetName}`,
        "failure",
        { reason: "rate_limited" },
      );
      return c.json({ error: "Rate limited" }, 429);
    }

    const cacheKey = `asset:${owner}:${repo}:${version}:${assetName}`;
    const cached = cacheManager.get(cacheKey);

    if (cached) {
      const checksum = cacheManager.getChecksum(cacheKey);
      c.header("X-Checksum-SHA256", checksum || "");

      if (assetSigner) {
        // @ts-ignore - Bun Buffer compatibility
        const cachedBuffer = Buffer.from(cached, "base64");
        const signature = assetSigner.sign(cachedBuffer);
        c.header("X-Signature-RSA-SHA256", signature);
      }

      auditLogger.logAction(
        device.device_id,
        "download_asset",
        `${owner}/${repo}/${version}/${assetName}`,
        "success",
        { cached: true },
      );
      c.header("Content-Type", "application/octet-stream");
      // @ts-ignore - Bun Buffer compatibility
      const buf = Buffer.from(cached, "base64");
      return new Response(buf);
    }

    const release = await githubClient.getRelease(owner, repo, version);

    if (!release) {
      auditLogger.logAction(
        device.device_id,
        "download_asset",
        `${owner}/${repo}/${version}/${assetName}`,
        "failure",
        { reason: "release_not_found" },
      );
      return c.json({ error: "Release not found" }, 404);
    }

    const asset = release.assets.find((a) => a.name === assetName);

    if (!asset) {
      auditLogger.logAction(
        device.device_id,
        "download_asset",
        `${owner}/${repo}/${version}/${assetName}`,
        "failure",
        { reason: "asset_not_found" },
      );
      return c.json({ error: "Asset not found" }, 404);
    }

    const data = await githubClient.downloadAsset(owner, repo, asset.id);

    if (!data) {
      auditLogger.logAction(
        device.device_id,
        "download_asset",
        `${owner}/${repo}/${version}/${assetName}`,
        "failure",
        { reason: "download_failed" },
      );
      return c.json({ error: "Failed to download asset" }, 500);
    }

    cacheManager.set(cacheKey, data);
    const checksum = createHash("sha256").update(data).digest("hex");

    c.header("X-Checksum-SHA256", checksum);

    if (assetSigner) {
      const signature = assetSigner.sign(data);
      c.header("X-Signature-RSA-SHA256", signature);
    }

    auditLogger.logAction(
      device.device_id,
      "download_asset",
      `${owner}/${repo}/${version}/${assetName}`,
      "success",
    );
    c.header("Content-Type", "application/octet-stream");
    return new Response(data);
  });

  return app;
}
