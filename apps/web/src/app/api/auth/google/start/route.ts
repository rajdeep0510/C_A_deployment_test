import crypto from "crypto";
import { NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/google-auth";

const STATE_COOKIE = "google_oauth_state";

export async function GET() {
  try {
    const state = crypto.randomBytes(24).toString("base64url");
    const url = getGoogleAuthUrl(state);

    const cookieDomain = process.env.COOKIE_DOMAIN;
    const res = NextResponse.redirect(url);
    res.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 60,
      path: "/",
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    });
    return res;
  } catch (err: any) {
    console.error("[google/start]", err);
    return NextResponse.json({ error: err.message ?? "Google auth unavailable" }, { status: 500 });
  }
}
