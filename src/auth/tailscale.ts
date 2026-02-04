import type { DeviceContext } from "../types";

export async function authenticateTailscale(
  headers: Record<string, string>,
  config?: Record<string, unknown>,
): Promise<DeviceContext | null> {
  const tsUser = headers["x-tailscale-user"];
  const tsDevice = headers["x-tailscale-device"];
  const tsIP = headers["x-tailscale-ip"];

  if (!tsUser || !tsDevice) {
    return null;
  }

  if (!config?.api_key) {
    throw new Error("Tailscale API key not configured");
  }

  try {
    const response = await fetch("https://api.tailscale.com/api/v2/devices", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.api_key}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as Record<string, unknown>;
    const devices = data.devices as Array<Record<string, unknown>> | undefined;

    if (!devices) {
      return null;
    }

    const device = devices.find((d) => (d.id as string) === tsDevice);

    if (!device) {
      return null;
    }

    return {
      device_id: tsDevice,
      device_name: device.name as string | undefined,
      user_id: tsUser,
      auth_method: "tailscale",
      ip_address: tsIP || "0.0.0.0",
      timestamp: Date.now(),
    };
  } catch {
    return null;
  }
}
