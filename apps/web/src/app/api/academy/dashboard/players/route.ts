import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await requireRole(request, "academy_owner");
  if (session instanceof NextResponse) return session;

  const academyId = session.app_user.profile?.academy_id;
  if (!academyId) {
    return NextResponse.json({ error: "No academy associated with your account" }, { status: 400 });
  }

  const coachId = new URL(request.url).searchParams.get("coachId");
  if (!coachId) {
    return NextResponse.json({ error: "coachId is required" }, { status: 400 });
  }

  const coach = await prisma.profiles.findUnique({ where: { id: coachId }, select: { academy_id: true } });
  if (coach?.academy_id !== academyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const players = await prisma.players.findMany({
    where:   { coach_id: coachId },
    select:  { id: true, full_name: true, chess_username: true, status: true, created_at: true },
    orderBy: { created_at: "asc" },
  });

  return NextResponse.json({ players });
}
