import { NextResponse } from "next/server";
import { verifyEmailToken } from "@/lib/auth";

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

  return NextResponse.redirect(new URL("/login?verified=1", request.url));
}
