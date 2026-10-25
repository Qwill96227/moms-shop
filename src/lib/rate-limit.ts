import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limiting layer.
 * With UPSTASH_REDIS_REST_URL/TOKEN set, limits are shared across every
 * server instance (what you want in production). Without them, a per-instance
 * in-memory sliding window keeps local dev and tests working.
 */
export type LimitResult = { ok: boolean; remaining: number; retryAfterSec: number };
type Rule = { limit: number; windowSec: number };

export const rules = {
  checkout: { limit: 10, windowSec: 60 },
  login: { limit: 5, windowSec: 15 * 60 },
  upload: { limit: 30, windowSec: 60 },
  adminWrite: { limit: 60, windowSec: 60 },
} satisfies Record<string, Rule>;

const memory = new Map<string, number[]>();

export function memoryLimit(key: string, rule: Rule, now = Date.now()): LimitResult {
  const windowMs = rule.windowSec * 1000;
  const hits = (memory.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= rule.limit) {
    memory.set(key, hits);
    return { ok: false, remaining: 0, retryAfterSec: Math.ceil((hits[0] + windowMs - now) / 1000) };
  }
  hits.push(now);
  memory.set(key, hits);
  if (memory.size > 10_000) memory.delete(memory.keys().next().value!);
  return { ok: true, remaining: rule.limit - hits.length, retryAfterSec: 0 };
}

export function resetMemoryLimits() {
  memory.clear();
}

const upstash = new Map<string, Ratelimit>();
function getUpstash(name: string, rule: Rule) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  let rl = upstash.get(name);
  if (!rl) {
    rl = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(rule.limit, `${rule.windowSec} s`),
      prefix: `rl:${name}`,
    });
    upstash.set(name, rl);
  }
  return rl;
}

export async function limit(name: keyof typeof rules, id: string): Promise<LimitResult> {
  const rule = rules[name];
  const rl = getUpstash(name, rule);
  if (rl) {
    const r = await rl.limit(id);
    return { ok: r.success, remaining: r.remaining, retryAfterSec: Math.max(0, Math.ceil((r.reset - Date.now()) / 1000)) };
  }
  return memoryLimit(`${name}:${id}`, rule);
}
