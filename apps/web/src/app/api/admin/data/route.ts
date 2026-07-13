import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await requireRole(request, "admin");
  if (session instanceof NextResponse) return session;

  const [academies, coaches, players] = await Promise.all([
    prisma.academies.findMany({ orderBy: { created_at: "desc" } }),
    prisma.profiles.findMany({
      where:   { role: "coach" },
      orderBy: { created_at: "desc" },
    }),
    prisma.players.findMany({ orderBy: { created_at: "desc" } }),
  ]);

  const ownerIds = academies.map((a) => a.owner_id).filter(Boolean) as string[];
  const ownerProfiles = ownerIds.length
    ? await prisma.profiles.findMany({
        where:  { id: { in: ownerIds } },
        select: { id: true, full_name: true, email: true },
      })
    : [];

  return NextResponse.json({ academies, coaches, players, ownerProfiles });
}

export async function PATCH(request: NextRequest) {
  const session = await requireRole(request, "admin");
  if (session instanceof NextResponse) return session;

  const { academyId, ownerId, status } = await request.json();

  if (!status) {
    return NextResponse.json({ error: "status is required" }, { status: 400 });
  }

  const ops: Promise<any>[] = [];
  if (academyId) ops.push(prisma.academies.update({ where: { id: academyId }, data: { status } }));
  if (ownerId)   ops.push(prisma.profiles.update({ where: { id: ownerId },   data: { status } }));

  await Promise.all(ops);
  return NextResponse.json({ ok: true });
}
