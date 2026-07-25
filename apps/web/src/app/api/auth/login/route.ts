import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSession, setSessionCookie, resolvePostLoginRedirect } from "@/lib/auth";

const DUMMY_HASH = "$2b$12$invalid.hash.for.timing.attack.prevention.only.x";

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

  const userAgent = request.headers.get("user-agent") ?? undefined;
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    undefined;

  try {

  // ── Player login (no @ → chess.com or lichess username) ───────────────────────
  if (!id.includes("@")) {
    const idLower = id.toLowerCase().trim();
    const player = await prisma.players.findFirst({
      where: { OR: [{ chess_username: idLower }, { lichess_username: idLower }] },
      include: { app_user: true },
    });

    // Always run bcrypt to keep response timing uniform across code paths.
    const hasPlaceholder = !!player?.app_user?.password_hash?.startsWith("*");
    const hashToVerify = player?.app_user && !hasPlaceholder ? player.app_user.password_hash : DUMMY_HASH;
    const passwordOk = password
      ? await verifyPassword(password, hashToVerify).catch(() => false)
      : false;

    if (!player || !player.app_user) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    if (player.status !== "approved") {
      return NextResponse.json(
        { error: "PENDING_APPROVAL", message: "Your account is pending approval from your coach." },
        { status: 403 }
      );
    }

    if (hasPlaceholder) {
      return NextResponse.json(
        { error: "PASSWORD_SETUP_REQUIRED", message: "Please set a password to continue.", id: idLower },
        { status: 403 }
      );
    }

    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    if (!passwordOk) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    const { rawToken } = await createSession(player.app_user.id, { userAgent, ipAddress });
    const response = NextResponse.json({ redirectTo: "/dashboard" });
    return setSessionCookie(response, rawToken);
  }

  // ── Staff login (has @ → email + password) ────────────────────────────────────
  if (!password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const user = await prisma.app_users.findUnique({
    where: { email_lower: id.toLowerCase().trim() },
    include: { profile: true, player: true },
  });

  // Always run bcrypt at full cost to prevent timing attacks regardless of user existence or migration status
  const isMigrated = user?.password_hash === "[MIGRATED]";
  const hashToVerify = !user || isMigrated ? DUMMY_HASH : user.password_hash;
  const passwordOk = await verifyPassword(password, hashToVerify).catch(() => false);

  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  if (isMigrated) {
    return NextResponse.json(
      { error: "PASSWORD_RESET_REQUIRED", message: "Please reset your password to continue." },
      { status: 403 }
    );
  }

  if (!passwordOk) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  if (!user.email_verified) {
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
