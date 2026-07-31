// Simple in-memory rate limiter shared by auth routes.
// NOTE: In-memory state is per-instance and resets on cold starts / restarts.
// That is consistent with the existing forgot-password / resend-verification
// routes. For a multi-instance deployment, replace this with Redis-backed
// limiting (see RISKS_CHECKLIST.md R3).

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

/**
 * Returns true if the key has exceeded `limit` requests within `windowMs`.
 * On the first request for a key (or after the window expires) the entry is
 * re-seeded with a fresh window. Otherwise the counter is incremented.
 */
export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  if (entry.count >= limit) return true;
  entry.count++;
  return false;
}

/** Best-effort client IP derived from standard proxy headers. */
export function getClientIp(request: Request): string | undefined {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    undefined
  );
}
