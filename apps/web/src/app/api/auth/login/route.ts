import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSession, setSessionCookie, resolvePostLoginRedirect } from "@/lib/auth";
import { isRateLimited, getClientIp } from "@/lib/rate-limit";

// A real bcrypt hash computed once at module load. It is used whenever there is
// no user, no stored hash, or a non-verifiable hash so that bcrypt always runs
// at full cost. This keeps response timing uniform across all login outcomes
// and prevents account enumeration via response timing.
const DUMMY_HASH = bcrypt.hashSync("timing-equalizer-dummy", 12);

// Brute-force / credential-stuffing guards (best-effort, in-memory).
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOGIN_MAX_PER_IP = 20; // cap across all usernames/emails
const LOGIN_MAX_PER_ID = 5; // cap per username/email

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id, password } = body;
  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json({ error: "Password is required" }, { status: 400 });
  }

  const userAgent = request.headers.get("user-agent") ?? undefined;
  const ipAddress = getClientIp(request);

  // Rate-limit before doing any DB work or bcrypt cost.
  const idLower = id.toLowerCase().trim();
  if (isRateLimited(`login:ip:${ipAddress ?? "unknown"}`, LOGIN_MAX_PER_IP, LOGIN_WINDOW_MS)) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      { status: 429 }
    );
  }
  if (isRateLimited(`login:id:${idLower}`, LOGIN_MAX_PER_ID, LOGIN_WINDOW_MS)) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      { status: 429 }
    );
  }

  try {
    // 1. Search for user via player username, player email, or app_user email_lower
    let user = await prisma.app_users.findFirst({
      where: {
        OR: [
          { email_lower: idLower },
          { player: { chess_username: idLower } },
          { player: { lichess_username: idLower } },
          { player: { email: idLower } },
        ],
      },
      include: { profile: true, player: true },
    });

    // 2. Fallback: search players directly to find associated app_user
    if (!user) {
      const playerRecord = await prisma.players.findFirst({
        where: {
          OR: [
            { chess_username: idLower },
            { lichess_username: idLower },
            { email: idLower },
          ],
        },
        include: { app_user: { include: { profile: true, player: true } } },
      });
      if (playerRecord?.app_user) {
        user = playerRecord.app_user;
      }
    }

    // Always run bcrypt for constant timing prevention
    const isMigrated = user?.password_hash === "[MIGRATED]";
    const hasPlaceholder = !!user?.password_hash?.startsWith("*");
    // Use DUMMY_HASH (never null) when there is no user, no stored hash, or a
    // non-verifiable hash, so `verifyPassword` always runs at full cost.
    const hashToVerify =
      user && user.password_hash && !isMigrated && !hasPlaceholder
        ? user.password_hash
        : DUMMY_HASH;
    const passwordOk = await verifyPassword(password, hashToVerify).catch(() => false);

    // Uniform failure responses: non-existent users and wrong passwords return
    // the same 401 body. The migrated/placeholder states are kept as explicit
    // 403s (transitional states that need user action) but they are only
    // reached AFTER the constant-time bcrypt compare above, so response timing
    // never reveals whether an account exists.
    if (!user) {
      return NextResponse.json({ error: "Invalid ID or password" }, { status: 401 });
    }

    if (isMigrated) {
      return NextResponse.json(
        { error: "PASSWORD_RESET_REQUIRED", message: "Please reset your password to continue." },
        { status: 403 }
      );
    }

    if (hasPlaceholder) {
      return NextResponse.json(
        { error: "PASSWORD_SETUP_REQUIRED", message: "Please set a password to continue.", id: idLower },
        { status: 403 }
      );
    }

    if (!passwordOk) {
      return NextResponse.json({ error: "Invalid ID or password" }, { status: 401 });
    }

    // Email verification check applies ONLY to staff profiles (coaches/admin/academy),
    // NOT to player accounts.
    if (user.profile && !user.email_verified) {
      return NextResponse.json(
        { error: "EMAIL_NOT_VERIFIED", message: "Please verify your email before logging in." },
        { status: 403 }
      );
    }

    const { rawToken } = await createSession(user.id, { userAgent, ipAddress });

    const profile = user.profile;
    const player = user.player;
    const redirectTo = resolvePostLoginRedirect({
      profile: profile ? { role: profile.role, status: profile.status } : null,
      player: player ? { status: player.status } : null,
    });

    const response = NextResponse.json({
      role: profile?.role ?? null,
      status: profile?.status ?? player?.status ?? null,
      redirectTo,
    });

    return setSessionCookie(response, rawToken);

  } catch (err) {
    console.error("[/api/auth/login] Unhandled error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
