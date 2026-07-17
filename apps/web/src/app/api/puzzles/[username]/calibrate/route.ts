import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username: _ } = await params;

  const data = await prisma.puzzle_library.findMany({
    where: { rating: { gte: 800, lte: 1800 } },
    select: { id: true, fen: true, moves: true, rating: true, themes: true, phase: true },
    take: 50,
  });

  if (!data.length) return NextResponse.json({ puzzles: [] });

  const sorted = [...data].sort((a, b) => a.rating - b.rating);
  const step   = Math.max(1, Math.floor(sorted.length / 10));
  const sample = Array.from({ length: 10 }, (_, i) => sorted[i * step]).filter(Boolean);

  return NextResponse.json({
    puzzles: sample.map((p) => ({
      puzzle_id: p.id,
      fen:       p.fen,
      moves:     p.moves,
      rating:    p.rating,
      themes:    p.themes,
      phase:     p.phase,
    })),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const { results } = await req.json() as { results: [number, boolean][] };

  if (!results?.length) {
    return NextResponse.json({ error: "No results" }, { status: 400 });
  }

  let score = 0;
  let count = 0;
  for (const [rating, solved] of results) {
    if (solved) { score += rating; count++; }
  }
  const baseRating    = count > 0 ? Math.round(score / count) : 1200;
  const clampedRating = Math.max(600, Math.min(2400, baseRating));

  await prisma.player_puzzle_rating.upsert({
    where:  { username },
    create: { username, rating: clampedRating, rd: 200, calibrated: true, streak_days: 0, updated_at: new Date() },
    update: { rating: clampedRating, rd: 200, calibrated: true, streak_days: 0, updated_at: new Date() },
  });

  return NextResponse.json({ rating: clampedRating, calibrated: true });
}
