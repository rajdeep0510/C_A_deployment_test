import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, setSessionCookie, resolvePostLoginRedirect } from "@/lib/auth";
import { exchangeCodeForProfile } from "@/lib/google-auth";

const STATE_COOKIE = "google_oauth_state";

// Use the origin the user actually hit (works for localhost, preview URLs, chessadvisor.in, etc.).
// Vercel puts the public host on x-forwarded-host; fall back to the request's own origin.
function getOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  return new URL(request.url).origin;
}

function redirectToLogin(request: Request, reason: string) {
  const cookieDomain = process.env.COOKIE_DOMAIN;
  const res = NextResponse.redirect(`${getOrigin(request)}/login?google_error=${encodeURIComponent(reason)}`);
  // Clear the one-shot state cookie on every failure path too (not just success).
  res.cookies.set(STATE_COOKIE, "", {
    maxAge: 0,
    path: "/",
    httpOnly: true,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  });
  return res;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) return redirectToLogin(request, error);
  if (!code || !state) return redirectToLogin(request, "missing_code");

  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieMatch = cookieHeader.match(new RegExp(`(?:^|;\\s*)${STATE_COOKIE}=([^;]+)`));
  const cookieState = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;

  if (!cookieState || cookieState !== state) {
    return redirectToLogin(request, "invalid_state");
  }

  let profile;
  try {
    profile = await exchangeCodeForProfile(code);
  } catch (err) {
    console.error("[google/callback] token exchange failed", err);
    return redirectToLogin(request, "token_exchange_failed");
  }

  const emailLower = profile.email.toLowerCase();

  // 1. Find by google_sub, else by email, else create.
  let user = await prisma.app_users.findUnique({ where: { google_sub: profile.sub } });

  if (!user) {
    const byEmail = await prisma.app_users.findUnique({ where: { email_lower: emailLower } });

    if (byEmail) {
      // Existing account. Only link Google when the email is already verified.
      // Never silently set `email_verified = true` here — that would bypass the
      // EMAIL_NOT_VERIFIED gate for accounts registered with a password.
      if (!byEmail.email_verified) {
        return redirectToLogin(request, "email_not_verified");
      }
      user = await prisma.app_users.update({
        where: { id: byEmail.id },
        data: { google_sub: profile.sub },
      });
    } else {
      // New account created via Google. Only trust the email when Google
      // itself verified it.
      if (!profile.emailVerified) {
        return redirectToLogin(request, "email_not_verified");
      }
      user = await prisma.app_users.create({
        data: {
          email: profile.email,
          google_sub: profile.sub,
          email_verified: true,
        },
      });
    }
  }

  // 2. Create a session and set the cookie.
  const { rawToken } = await createSession(user.id, {
    userAgent: request.headers.get("user-agent") ?? undefined,
  });

  // 3. Decide destination based on whether onboarding is complete.
  const [profileRow, playerRow] = await Promise.all([
    prisma.profiles.findUnique({ where: { id: user.id } }),
    prisma.players.findUnique({ where: { user_id: user.id } }),
  ]);

  const path = resolvePostLoginRedirect({
    profile: profileRow ? { role: profileRow.role, status: profileRow.status } : null,
    player: playerRow ? { status: playerRow.status } : null,
  });
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL || getOrigin(request);
  const destination = `${appOrigin}${path}`;

  const res = NextResponse.redirect(destination);
  setSessionCookie(res, rawToken);
  // Clear one-shot state cookie.
  const cookieDomain = process.env.COOKIE_DOMAIN;
  res.cookies.set(STATE_COOKIE, "", {
    maxAge: 0,
    path: "/",
    httpOnly: true,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  });
  return res;
}
