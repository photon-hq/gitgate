/**
 * @fileoverview Utility to validate unauthenticated access policies.
 */

/**
 * Strict allowlist of environments permitted to run without authentication.
 */
const NO_AUTH_ENVS: ReadonlySet<string> = new Set(["development", "test"]);

/**
 * Evaluates whether unauthenticated ("none") access is explicitly permitted.
 *
 * Implements a strict fail-closed security boundary:
 * - Requires explicit opt-in via ALLOW_NO_AUTH="true".
 * - Restricts execution strictly to "development" or "test" environments.
 * - Fails closed if NODE_ENV is undefined, empty, "production", or any other value.
 *
 * @returns True only if both conditions are strictly satisfied; otherwise false.
 */
export function isNoAuthAllowed(): boolean {
  return (
    process.env.ALLOW_NO_AUTH === "true" &&
    NO_AUTH_ENVS.has(process.env.NODE_ENV ?? "")
  );
}
