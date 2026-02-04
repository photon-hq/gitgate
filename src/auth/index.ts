import type { DeviceContext } from "../types";
import { authenticateJamf } from "./jamf";
import { authenticateTailscale } from "./tailscale";
import { authenticateMTLS } from "./mtls";

export async function authenticateDevice(
  method: string,
  headers: Record<string, string>,
  clientCert?: string,
  config?: Record<string, unknown>,
): Promise<DeviceContext | null> {
  switch (method) {
    case "jamf":
      return authenticateJamf(headers, config);
    case "tailscale":
      return authenticateTailscale(headers, config);
    case "mtls":
      return authenticateMTLS(clientCert, config);
    case "none":
      return {
        device_id: "unknown",
        auth_method: "none",
        ip_address: "0.0.0.0",
        timestamp: Date.now(),
      };
    default:
      return null;
  }
}

export { authenticateJamf } from "./jamf";
export { authenticateTailscale } from "./tailscale";
export { authenticateMTLS } from "./mtls";
