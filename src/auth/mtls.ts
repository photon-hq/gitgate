import { readFileSync } from "node:fs";
import type { DeviceContext } from "../types";

export async function authenticateMTLS(
  clientCert?: string,
  config?: Record<string, unknown>,
): Promise<DeviceContext | null> {
  if (!clientCert) {
    return null;
  }

  if (!config?.ca_cert_path) {
    throw new Error("mTLS CA certificate path not configured");
  }

  try {
    const caCert = readFileSync(config.ca_cert_path as string, "utf-8");

    const certLines = clientCert.split("\n");
    const subjectLine = certLines.find((line) => line.includes("Subject:"));

    if (!subjectLine) {
      return null;
    }

    const cnMatch = subjectLine.match(/CN\s*=\s*([^,]+)/);
    const deviceId = cnMatch ? cnMatch[1].trim() : null;

    if (!deviceId) {
      return null;
    }

    return {
      device_id: deviceId,
      auth_method: "mtls",
      ip_address: "0.0.0.0",
      timestamp: Date.now(),
    };
  } catch {
    return null;
  }
}
