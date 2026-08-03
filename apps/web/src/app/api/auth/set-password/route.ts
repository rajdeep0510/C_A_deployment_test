import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSession, setSessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id, newPassword } = body;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Username or email is required" }, { status: 400 });
  }
  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const userAgent = request.headers.get("user-agent") ?? undefined;
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    undefined;

  const idLower = id.toLowerCase().trim();

  try {
    // Resolve the player by username OR email (a legacy player may log in with
    // their email and reach this step).
    const player = await prisma.players.findFirst({
      where: {
        OR: [
          { chess_username: idLower },
          { lichess_username: idLower },
          { email: idLower },
          { app_user: { email_lower: idLower } },
        ],
      },
      include: { app_user: true },
    });

    if (!player || !player.app_user) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (player.status !== "approved") {
      return NextResponse.json(
        { error: "PENDING_APPROVAL", message: "Your account is pending approval from your coach." },
        { status: 403 }
      );
    }

    if (!player.app_user.password_hash?.startsWith("*")) {
      return NextResponse.json(
        { error: "Password already set. Please log in normally." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.app_users.update({
      where: { id: player.app_user.id },
      data: { password_hash: passwordHash },
    });

    const { rawToken } = await createSession(player.app_user.id, { userAgent, ipAddress });
    const response = NextResponse.json({ redirectTo: "/dashboard" });
    return setSessionCookie(response, rawToken);
  } catch (err) {
    console.error("[/api/auth/set-password] Unhandled error:", err);
    return NextResponse.json({ error: "Failed to set password" }, { status: 500 });
  }
}
