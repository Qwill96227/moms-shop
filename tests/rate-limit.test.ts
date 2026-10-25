import { beforeEach, describe, expect, it } from "vitest";
import { memoryLimit, resetMemoryLimits } from "@/lib/rate-limit";

describe("rate limiting", () => {
  beforeEach(() => resetMemoryLimits());

  it("blocks after the limit and frees up after the window", () => {
    const rule = { limit: 3, windowSec: 60 };
    const t0 = 1_000_000;
    expect(memoryLimit("ip", rule, t0).ok).toBe(true);
    expect(memoryLimit("ip", rule, t0 + 1).ok).toBe(true);
    expect(memoryLimit("ip", rule, t0 + 2).ok).toBe(true);
    const blocked = memoryLimit("ip", rule, t0 + 3);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(memoryLimit("other-ip", rule, t0 + 3).ok).toBe(true);
    expect(memoryLimit("ip", rule, t0 + 61_000).ok).toBe(true);
  });
});
