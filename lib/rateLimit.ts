// ---------------------------------------------------------------------------
// In-memory per-user rate limiting for AI endpoints (score + test-key).
// No new dependencies.
//
// LIMITATION: the buckets live in this server process only. On Vercel each
// serverless instance has its own map, so the limit is enforced per
// instance, not globally across all instances, and it resets on cold
// start. That is acceptable here: the goal is to stop a single account
// from looping scoring requests and burning the operator's server key,
// not to build a precise global quota. If exact global quotas are ever
// needed, move this to Upstash Redis (@upstash/ratelimit).
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';

const buckets = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  /** Milliseconds until the oldest hit in the window expires (0 when allowed). */
  retryAfterMs: number;
}

/**
 * Sliding-window check: at most `limit` hits per `windowMs` for `key`
 * (key = `${userId}:${route}`).
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return { allowed: false, retryAfterMs: Math.max(0, hits[0] + windowMs - now) };
  }
  hits.push(now);
  buckets.set(key, hits);
  return { allowed: true, retryAfterMs: 0 };
}

/** 429 response for a rejected request. Shape matches other API errors. */
export function rateLimitResponse(retryAfterMs: number) {
  return NextResponse.json(
    { error: 'Bạn gửi quá nhanh. Đợi một chút rồi thử lại.' },
    {
      status: 429,
      headers: { 'Retry-After': String(Math.max(1, Math.ceil(retryAfterMs / 1000))) },
    }
  );
}
