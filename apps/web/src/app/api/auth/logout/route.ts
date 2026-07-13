import { NextResponse } from "next/server";
import { hashToken, invalidateSession, clearSessionCookie } from "@/lib/auth";

const SESSION_COOKIE = "chess_session";

export async function POST(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  const rawToken = match ? decodeURIComponent(match[1]) : null;

  if (rawToken) {
    await invalidateSession(hashToken(rawToken));
  }

  const response = NextResponse.json({ ok: true });
  return clearSessionCookie(response);
}
