import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: playerId } = await params;

  const session = await requireRole(request, "admin");
  if (session instanceof NextResponse) return session;

  const player = await prisma.players.findUnique({
    where: { id: playerId },
    select: { user_id: true },
  });

  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  await prisma.players.delete({ where: { id: playerId } });

  if (player.user_id) {
    await prisma.app_users.delete({ where: { id: player.user_id } });
  }

  return NextResponse.json({ message: "Player deleted successfully" });
}
