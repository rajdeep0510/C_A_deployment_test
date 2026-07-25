import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof NextResponse) return session;

  const player = session.app_user.player;
  if (!player) return NextResponse.json({ error: "No player profile" }, { status: 404 });

  return NextResponse.json({
    chess_username: player.chess_username,
    lichess_username: player.lichess_username,
    active_platform: player.active_platform,
    chess_username_changes: player.chess_username_changes,
    lichess_username_changes: player.lichess_username_changes,
  });
}
