import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPasswordResetToken } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/email";

// Simple in-memory rate limiter: max 3 requests per 10 minutes per email
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(email: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(email);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(email, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return false;
  }
  if (entry.count >= 3) return true;
  entry.count++;
  return false;
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.toLowerCase().trim();
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Always return same response to prevent email enumeration
  const ok = NextResponse.json({ ok: true });

  if (isRateLimited(email)) return ok;

  const user = await prisma.app_users.findUnique({
    where: { email_lower: email },
    include: { profile: true },
  });

  if (!user) return ok;

  const rawToken = await createPasswordResetToken(user.id);
  const fullName = user.profile?.full_name ?? "there";
  await sendPasswordResetEmail(user.email, rawToken, fullName);

  return ok;
}
