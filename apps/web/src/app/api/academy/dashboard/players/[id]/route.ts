import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireRole(request, "academy_owner");
  if (session instanceof NextResponse) return session;

  const academyId = session.app_user.profile?.academy_id;
  if (!academyId) {
    return NextResponse.json({ error: "No academy associated with your account" }, { status: 400 });
  }

  const { id } = await params;

  const player = await prisma.players.findUnique({
    where:  { id },
    select: { coach_id: true },
  });

  if (player?.coach_id) {
    const coach = await prisma.profiles.findUnique({
      where:  { id: player.coach_id },
      select: { academy_id: true },
    });
    if (coach?.academy_id !== academyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  await prisma.players.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
