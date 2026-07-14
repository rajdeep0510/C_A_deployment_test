import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, createEmailVerificationToken } from "@/lib/auth";
import { sendPlayerApprovalEmail } from "@/lib/email";

export async function GET(request: NextRequest) {
  const session = await requireRole(request, "coach");
  if (session instanceof NextResponse) return session;

  const coachId  = session.app_user.profile?.id;
  const academyId = session.app_user.profile?.academy_id;

  const [approvedPlayers, pendingPlayers, profile] = await Promise.all([
    prisma.players.findMany({
      where:   { coach_id: coachId, status: "approved" },
      orderBy: { full_name: "asc" },
    }),
    prisma.players.findMany({
      where:   { coach_id: coachId, status: "pending" },
      orderBy: { created_at: "asc" },
    }),
    prisma.profiles.findUnique({
      where:  { id: coachId },
      select: { invite_code: true },
    }),
  ]);

  let academyName: string | null = null;
  if (academyId) {
    const academy = await prisma.academies.findUnique({
      where:  { id: academyId },
      select: { name: true },
    });
    academyName = academy?.name ?? null;
  }

  return NextResponse.json({
    approvedPlayers,
    pendingPlayers,
    inviteCode:  profile?.invite_code ?? null,
    academyName,
  });
}

export async function PATCH(request: NextRequest) {
  const session = await requireRole(request, "coach");
  if (session instanceof NextResponse) return session;

  const coachId = session.app_user.profile?.id;
  const { playerId, status } = await request.json();

  if (!playerId || !status) {
    return NextResponse.json({ error: "playerId and status are required" }, { status: 400 });
  }

  const player = await prisma.players.findUnique({ where: { id: playerId }, select: { coach_id: true } });
  if (player?.coach_id !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.players.update({ where: { id: playerId }, data: { status } });

  if (status === "approved" && updated.user_id && updated.email) {
    const rawToken = await createEmailVerificationToken(updated.user_id);
    await sendPlayerApprovalEmail(updated.email, rawToken, updated.full_name ?? "");
  }

  return NextResponse.json(updated);
}
