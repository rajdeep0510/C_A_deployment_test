import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const chessUsername = session.app_user.player?.chess_username;
  if (!chessUsername) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const notes = await prisma.game_annotations.findMany({
    where: {
      player_username: { equals: chessUsername, mode: "insensitive" },
    },
    orderBy: { created_at: "desc" },
    select: { id: true, filename: true, move_index: true, note: true, created_at: true, coach_id: true },
  });

  return NextResponse.json({ notes });
}
