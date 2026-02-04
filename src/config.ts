import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Config } from "./types";

let cachedConfig: Config | null = null;

export function loadConfig(configPath?: string): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  const path =
    configPath ||
    process.env.GITGATE_CONFIG ||
    resolve(process.cwd(), "config.json");

  try {
    const content = readFileSync(path, "utf-8");
    cachedConfig = JSON.parse(content) as Config;
    return cachedConfig;
  } catch (error) {
    throw new Error(
      `Failed to load config from ${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function getConfig(): Config {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}

export function validateConfig(config: Config): boolean {
  if (!config.port || config.port < 1 || config.port > 65535) {
    throw new Error("Invalid port number");
  }

  if (!config.github?.token) {
    throw new Error("GitHub token is required");
  }

  if (!config.github?.cache_dir) {
    throw new Error("Cache directory is required");
  }

  if (!config.auth?.method) {
    throw new Error("Auth method is required");
  }

  return true;
}
