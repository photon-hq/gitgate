import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

export interface GitHubAuthProvider {
  getToken(): Promise<string>;
}

export interface GitHubAppAuthOptions {
  appId: string;
  installationId: string;
  privateKey?: string;
  privateKeyPath?: string;
}

interface InstallationTokenResponse {
  token: string;
  expires_at: string;
}

const TOKEN_REFRESH_SKEW_MS = 5 * 60 * 1000;

function base64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function normalizePrivateKey(value: string): string {
  return value.replace(/\\n/g, "\n");
}

export class StaticGitHubAuthProvider implements GitHubAuthProvider {
  constructor(private readonly token: string) {}

  async getToken(): Promise<string> {
    return this.token;
  }
}

export class GitHubAppAuthProvider implements GitHubAuthProvider {
  private readonly privateKey: string;
  private cachedToken: string | null = null;
  private cachedTokenExpiresAt = 0;

  constructor(private readonly opts: GitHubAppAuthOptions) {
    if (opts.privateKey) {
      this.privateKey = normalizePrivateKey(opts.privateKey);
      return;
    }

    if (!opts.privateKeyPath) {
      throw new Error("GitHub App private key is required");
    }

    this.privateKey = readFileSync(opts.privateKeyPath, "utf-8");
  }

  async getToken(): Promise<string> {
    if (
      this.cachedToken &&
      Date.now() < this.cachedTokenExpiresAt - TOKEN_REFRESH_SKEW_MS
    ) {
      return this.cachedToken;
    }

    const jwt = this.createJwt();
    const response = await fetch(
      `https://api.github.com/app/installations/${this.opts.installationId}/access_tokens`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${jwt}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Failed to create GitHub App installation token: ${response.status} ${body}`,
      );
    }

    const data = (await response.json()) as InstallationTokenResponse;
    this.cachedToken = data.token;
    this.cachedTokenExpiresAt = Date.parse(data.expires_at);
    return data.token;
  }

  private createJwt(): string {
    const now = Math.floor(Date.now() / 1000);
    const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const payload = base64Url(
      JSON.stringify({
        iat: now - 60,
        exp: now + 9 * 60,
        iss: this.opts.appId,
      }),
    );
    const unsigned = `${header}.${payload}`;
    const signer = createSign("RSA-SHA256");
    signer.update(unsigned);
    signer.end();
    return `${unsigned}.${base64Url(signer.sign(this.privateKey))}`;
  }
}

