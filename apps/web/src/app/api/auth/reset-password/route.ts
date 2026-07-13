import { NextResponse } from "next/server";
import { hashPassword, verifyPasswordResetToken, consumePasswordResetToken } from "@/lib/auth";

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { token, password } = body;
  if (!token || !password) {
    return NextResponse.json({ error: "Token and password are required" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const resetToken = await verifyPasswordResetToken(token);
  if (!resetToken) {
    return NextResponse.json({ error: "INVALID_OR_EXPIRED_TOKEN" }, { status: 400 });
  }

  const newHash = await hashPassword(password);
  await consumePasswordResetToken(resetToken.id, newHash, resetToken.user_id);

  return NextResponse.json({ ok: true });
}
