import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

type Platform = "chess.com" | "lichess";

export async function PATCH(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof NextResponse) return session;

  const player = session.app_user.player;
  if (!player) {
    return NextResponse.json({ error: "No player profile" }, { status: 404 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const platform: Platform | undefined = body.platform;
  const rawUsername: string | undefined = body.username;

  if (platform !== "chess.com" && platform !== "lichess") {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }

  const username = rawUsername?.trim().toLowerCase();
  if (!username) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
  }

  const isChess = platform === "chess.com";
  const changes = isChess ? player.chess_username_changes : player.lichess_username_changes;
  const current = isChess ? player.chess_username : player.lichess_username;

  if (changes >= 1) {
    return NextResponse.json({ error: "Username can only be changed once" }, { status: 403 });
  }

  if (current && username === current) {
    return NextResponse.json({ error: "New username is the same as the current one" }, { status: 400 });
  }

  // Collision check across all players.
  const collision = await prisma.players.findUnique({
    where: isChess ? { chess_username: username } : { lichess_username: username },
  });
  if (collision && collision.id !== player.id) {
    return NextResponse.json({ error: "This username is already registered." }, { status: 409 });
  }

  const updated = await prisma.players.update({
    where: { id: player.id },
    data: isChess
      ? { chess_username: username, chess_username_changes: { increment: 1 } }
      : { lichess_username: username, lichess_username_changes: { increment: 1 } },
  });

  return NextResponse.json({
    ok: true,
    chessUsername: updated.chess_username,
    lichessUsername: updated.lichess_username,
    chessUsernameChanges: updated.chess_username_changes,
    lichessUsernameChanges: updated.lichess_username_changes,
  });
}
