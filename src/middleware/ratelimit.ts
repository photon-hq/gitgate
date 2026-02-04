import type { RateLimitState } from "../types";

export class RateLimiter {
  private limits: Map<string, RateLimitState>;
  private requestsPerMinute: number;

  constructor(requestsPerMinute: number = 60) {
    this.limits = new Map();
    this.requestsPerMinute = requestsPerMinute;
  }

  isAllowed(deviceId: string): boolean {
    const now = Date.now();
    const state = this.limits.get(deviceId);

    if (!state || now > state.reset_at) {
      this.limits.set(deviceId, {
        requests: 1,
        reset_at: now + 60000,
      });
      return true;
    }

    if (state.requests < this.requestsPerMinute) {
      state.requests += 1;
      return true;
    }

    return false;
  }

  getRemainingRequests(deviceId: string): number {
    const now = Date.now();
    const state = this.limits.get(deviceId);

    if (!state || now > state.reset_at) {
      return this.requestsPerMinute;
    }

    return Math.max(0, this.requestsPerMinute - state.requests);
  }

  getResetTime(deviceId: string): number {
    const state = this.limits.get(deviceId);
    return state?.reset_at || Date.now();
  }
}
