import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const { searchParams } = req.nextUrl;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
  const phase = searchParams.get("phase");

  const allPuzzles = await prisma.puzzles.findMany({
    where: {
      username,
      source: "own_game",
      ...(phase ? { phase } : {}),
    },
    select: {
      puzzle_id:     true,
      fen:           true,
      best_move:     true,
      theme:         true,
      difficulty:    true,
      phase:         true,
      puzzle_rating: true,
      game_filename: true,
      move_number:   true,
    },
    orderBy: { created_at: "desc" },
    take:    200,
  });

  if (!allPuzzles.length) return NextResponse.json({ queue: [] });

  const ids = allPuzzles.map((p) => p.puzzle_id);

  const progress = await prisma.puzzle_progress.findMany({
    where:  { username, puzzle_id: { in: ids } },
    select: { puzzle_id: true, attempts: true, next_review: true, last_solved: true },
  });

  const progressMap = new Map(progress.map((p) => [p.puzzle_id, p]));
  const today = new Date().toISOString().split("T")[0];

  const due: any[]    = [];
  const unseen: any[] = [];
  const rest: any[]   = [];

  for (const p of allPuzzles) {
    const pp = progressMap.get(p.puzzle_id);
    if (!pp || pp.attempts === 0) { unseen.push(p); continue; }
    const nextReviewStr = pp.next_review?.toISOString().split("T")[0] ?? "9999-99-99";
    if (nextReviewStr <= today) { due.push(p); continue; }
    rest.push(p);
  }

  const queue = [...due, ...unseen, ...rest]
    .slice(0, limit)
    .map((p) => ({ ...p, source: "own_game" }));

  return NextResponse.json({ queue });
}
