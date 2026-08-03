import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { isRateLimited, getClientIp } from "@/lib/rate-limit";

// Shared hardening for the analysis/batch APIs (RISKS_CHECKLIST.md R4/R15).
//
// Before R4/R15 these endpoints were unauthenticated and unthrottled, so any
// caller could create unlimited analysis/batch jobs and burn worker CPU
// against Stockfish. Every frontend consumer of these routes lives behind a
// login-gated page, and the Python worker writes to Supabase directly (it
// never calls these web routes), so requiring a session here is safe.

export const ANALYSIS_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Job-creation endpoints: POST /api/analyze, POST /api/batch,
// GET /api/analyze/[username]/batch
export const ANALYSIS_MAX_PER_IP = 30;
export const ANALYSIS_MAX_PER_USER = 50;

// Heavier endpoints that also make outbound fetches to chess.com/lichess.
export const BATCH_MAX_PER_IP = 10;
export const BATCH_MAX_PER_USER = 20;

// Read-only status endpoints.
export const STATUS_MAX_PER_IP = 60;
export const STATUS_MAX_PER_USER = 120;

// Server-side caps applied regardless of what the client sends.
export const MAX_BATCH_GAME_URLS = 100;
export const MAX_INFLIGHT_JOBS_PER_USER = 50;

export type AnalysisLimits = {
  perIp: number;
  perUser: number;
};

/**
 * Require a valid session and enforce per-IP + per-user rate limits.
 *
 * Returns `{ session, response: null }` on success, or `{ session: null,
 * response }` with a 401 (no session) / 429 (rate limited) response.
 */
export async function requireAnalysisAuth(
  request: NextRequest,
  scope: string,
  limits: AnalysisLimits = { perIp: ANALYSIS_MAX_PER_IP, perUser: ANALYSIS_MAX_PER_USER }
): Promise<{ session: Awaited<ReturnType<typeof requireAuth>>; response: null } | { session: null; response: NextResponse }> {
  const session = await requireAuth(request);
  if (session instanceof NextResponse) {
    return { session: null, response: session };
  }

  const ip = getClientIp(request) ?? "unknown";
  if (isRateLimited(`analysis:${scope}:ip:${ip}`, limits.perIp, ANALYSIS_WINDOW_MS)) {
    return {
      session: null,
      response: NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      ),
    };
  }

  const userId = session.app_user.id;
  if (isRateLimited(`analysis:${scope}:user:${userId}`, limits.perUser, ANALYSIS_WINDOW_MS)) {
    return {
      session: null,
      response: NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      ),
    };
  }

  return { session, response: null };
}

/**
 * Count in-flight (pending + processing) analysis jobs for a username.
 * Used to enforce the per-user job quota before creating new jobs.
 */
export async function inflightAnalysisJobCount(username: string): Promise<number> {
  return prisma.analysis_jobs.count({
    where: { username, status: { in: ["pending", "processing"] } },
  });
}

/**
 * Validate a batch's game_urls: every URL must point to a supported platform
 * game page (Chess.com or Lichess). This is the cheap existence / relevance
 * check: it costs no outbound fetch and prevents the worker from being
 * pointed at arbitrary URLs.
 *
 * Returns the validated URLs, or `null` when the input is empty / contains no
 * valid URLs. Batches larger than MAX_BATCH_GAME_URLS are rejected (the
 * caller returns 400) so the size cap is enforced regardless of client input.
 */
export function validateBatchGameUrls(gameUrls: unknown[]): string[] | null {
  if (!Array.isArray(gameUrls) || gameUrls.length === 0) return null;

  const valid = gameUrls
    .filter((u): u is string => typeof u === "string")
    .filter((u) => /^https:\/\/(www\.)?(chess\.com\/game\/|lichess\.org\/)/.test(u));

  if (valid.length === 0 || valid.length > MAX_BATCH_GAME_URLS) return null;
  return valid;
}
