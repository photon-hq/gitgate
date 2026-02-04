import type { DeviceContext } from "../types";

export async function authenticateJamf(
  headers: Record<string, string>,
  config?: Record<string, unknown>,
): Promise<DeviceContext | null> {
  const jamfToken = headers["x-jamf-token"];

  if (!jamfToken) {
    return null;
  }

  if (!config?.api_url || !config?.api_key || !config?.api_secret) {
    throw new Error("Jamf configuration incomplete");
  }

  try {
    const response = await fetch(`${config.api_url}/api/v1/auth/tokens`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${jamfToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as Record<string, unknown>;
    const deviceId = data.device_id as string | undefined;
    const deviceName = data.device_name as string | undefined;
    const userId = data.user_id as string | undefined;

    if (!deviceId) {
      return null;
    }

    return {
      device_id: deviceId,
      device_name: deviceName,
      user_id: userId,
      auth_method: "jamf",
      ip_address: headers["x-forwarded-for"] || "0.0.0.0",
      timestamp: Date.now(),
    };
  } catch {
    return null;
  }
}
