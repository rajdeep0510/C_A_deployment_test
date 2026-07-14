import { NextResponse } from "next/server";
import { verifyEmailToken, createSession, setSessionCookie } from "@/lib/auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawToken = searchParams.get("token");

  if (!rawToken) {
    return NextResponse.redirect(new URL("/verify-email?error=missing", request.url));
  }

  const user = await verifyEmailToken(rawToken);

  if (!user) {
    return NextResponse.redirect(new URL("/verify-email?error=expired", request.url));
  }

  // Players have no password — auto-login them directly after email verification
  if (user.player) {
    const userAgent = request.headers.get("user-agent") ?? undefined;
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      request.headers.get("x-real-ip") ??
      undefined;
    const { rawToken: sessionToken } = await createSession(user.id, { userAgent, ipAddress });
    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    return setSessionCookie(response, sessionToken);
  }

  return NextResponse.redirect(new URL("/login?verified=1", request.url));
}
