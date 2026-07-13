import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await requireRole(request, "coach");
  if (session instanceof NextResponse) return session;

  const academyId = session.app_user.profile?.academy_id;
  if (!academyId) return NextResponse.json({ academy: null, coaches: [] });

  const [academy, coaches, players] = await Promise.all([
    prisma.academies.findUnique({ where: { id: academyId } }),
    prisma.profiles.findMany({
      where:   { academy_id: academyId, role: "coach", status: "approved" },
      select:  { id: true, full_name: true, email: true, created_at: true },
      orderBy: { created_at: "asc" },
    }),
    prisma.players.findMany({
      where:  { status: "approved" },
      select: { coach_id: true },
    }),
  ]);

  const enriched = coaches.map((c) => ({
    ...c,
    playerCount: players.filter((p) => p.coach_id === c.id).length,
  }));

  return NextResponse.json({ academy, coaches: enriched });
}
