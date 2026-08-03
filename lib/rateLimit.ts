import "server-only";

/**
 * In-memory fixed-window limiter. State lives in this process only, so on a
 * multi-instance deploy (Vercel serverless) each instance keeps its own counter
 * and the effective limit is `max * instances`. That is still enough to stop the
 * abuse this guards against — scripted registration floods burning the Resend
 * quota, and unauthenticated search/upload hammering. Swap the Map for Redis
 * (Upstash) if this ever needs to be exact across instances.
 */
const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, max: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    if (hits.size > 10_000) pruneExpired(now);
    return { ok: true, retryAfterSec: 0 };
  }

  entry.count += 1;
  if (entry.count > max) {
    return { ok: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfterSec: 0 };
}

function pruneExpired(now: number) {
  for (const [k, v] of hits) {
    if (v.resetAt <= now) hits.delete(k);
  }
}

/** Best-effort client IP; behind a proxy Next populates x-forwarded-for. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
