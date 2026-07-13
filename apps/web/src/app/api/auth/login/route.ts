import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSession, setSessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, password } = body;
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const user = await prisma.app_users.findUnique({
    where: { email_lower: email.toLowerCase() },
    include: { profile: true, player: true },
  });

  // Always run bcrypt at full cost to prevent timing attacks regardless of user existence or migration status
  const DUMMY_HASH = "$2b$12$invalid.hash.for.timing.attack.prevention.only.x";
  const isMigrated = user?.password_hash === "[MIGRATED]";
  const hashToVerify = !user || isMigrated ? DUMMY_HASH : user.password_hash;
  const passwordOk = await verifyPassword(password, hashToVerify).catch(() => false);

  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  // Existing staff migrated from Supabase Auth — must reset password before first login
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

  const userAgent = request.headers.get("user-agent") ?? undefined;
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    undefined;

  const { rawToken } = await createSession(user.id, { userAgent, ipAddress });

  // Determine redirect
  let userType: "staff" | "player" = "player";
  let redirectTo = "/dashboard";
  const profile = user.profile;
  const player = user.player;

  if (profile) {
    userType = "staff";
    if (profile.role === "admin") redirectTo = "/admin/dashboard";
    else if (profile.role === "academy_owner") {
      redirectTo = profile.status === "pending" ? "/academy/pending" : "/academy/dashboard";
    } else {
      redirectTo = profile.status === "pending" ? "/coach/pending" : "/coach/dashboard";
    }
  } else if (player) {
    redirectTo = player.status === "pending" ? "/pending" : "/dashboard";
  }

  const response = NextResponse.json({
    userType,
    role: profile?.role ?? null,
    status: profile?.status ?? player?.status ?? null,
    redirectTo,
  });

  return setSessionCookie(response, rawToken);
}
