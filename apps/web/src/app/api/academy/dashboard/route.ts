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

  const [academy, coaches] = await Promise.all([
    prisma.academies.findUnique({ where: { id: academyId } }),
    prisma.profiles.findMany({
      where:   { academy_id: academyId, role: "coach" },
      select:  { id: true, full_name: true, email: true, created_at: true, status: true },
      orderBy: { created_at: "asc" },
    }),
  ]);

  return NextResponse.json({ academy, coaches });
}

export async function PATCH(request: NextRequest) {
  const session = await requireRole(request, "academy_owner");
  if (session instanceof NextResponse) return session;

  const academyId = session.app_user.profile?.academy_id;
  if (!academyId) {
    return NextResponse.json({ error: "No academy associated with your account" }, { status: 400 });
  }

  const { coachId, status } = await request.json();
  if (!coachId || !status) {
    return NextResponse.json({ error: "coachId and status are required" }, { status: 400 });
  }

  const coach = await prisma.profiles.findUnique({ where: { id: coachId }, select: { academy_id: true } });
  if (coach?.academy_id !== academyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.profiles.update({ where: { id: coachId }, data: { status } });
  return NextResponse.json({ ok: true });
}
