import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "chess_session";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const hostname = host.split(":")[0]; // remove port if any
  const pathname = request.nextUrl.pathname;

  // Ignore static assets, next internal routes, and public files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/stockfish") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has(SESSION_COOKIE);
  const landingUrl = process.env.NEXT_PUBLIC_LANDING_URL || "https://chessadvisor.in";
  const authUrl = process.env.NEXT_PUBLIC_AUTH_URL || "https://auth.chessadvisor.in";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.chessadvisor.in";

  // 1. Apex / Landing Domain (chessadvisor.in or www.chessadvisor.in)
  if (hostname === "chessadvisor.in" || hostname === "www.chessadvisor.in") {
    // If authenticated user visits root landing page, redirect to app subdomain
    if (hasSession && pathname === "/") {
      return NextResponse.redirect(new URL("/dashboard", appUrl));
    }
    return NextResponse.next();
  }

  // 2. Auth Subdomain (auth.chessadvisor.in)
  if (hostname.startsWith("auth.")) {
    // If already authenticated user visits auth routes like login/signup, redirect to app subdomain
    if (hasSession && (pathname === "/login" || pathname === "/register" || pathname === "/")) {
      return NextResponse.redirect(new URL("/dashboard", appUrl));
    }
    return NextResponse.next();
  }

  // 3. App Subdomain (app.chessadvisor.in)
  if (hostname.startsWith("app.")) {
    // If user tries to access login/register directly on app subdomain, redirect to auth subdomain
    if (pathname === "/login" || pathname === "/register") {
      return NextResponse.redirect(new URL(pathname, authUrl));
    }

    // Require auth for app subdomain routes (except public static routes)
    if (!hasSession && pathname !== "/") {
      const loginTarget = new URL("/login", authUrl);
      loginTarget.searchParams.set("redirectTo", request.url);
      return NextResponse.redirect(loginTarget);
    }
    return NextResponse.next();
  }

  // Fallback for local development (localhost / 127.0.0.1) or unmapped hostnames
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
