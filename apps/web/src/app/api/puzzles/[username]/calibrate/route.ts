import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// GET – return 10 calibration puzzles (spread across difficulty levels)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username: _ } = await params;

  const { data } = await supabaseAdmin
    .from("puzzle_library")
    .select("id, fen, moves, rating, themes, phase")
    .gte("rating", 800)
    .lte("rating", 1800)
    .limit(50);

  if (!data?.length) return NextResponse.json({ puzzles: [] });

  // Sample 10 across the difficulty range
  const sorted = [...data].sort((a, b) => a.rating - b.rating);
  const step   = Math.max(1, Math.floor(sorted.length / 10));
  const sample = Array.from({ length: 10 }, (_, i) => sorted[i * step]).filter(Boolean);

  return NextResponse.json({
    puzzles: sample.map((p) => ({
      puzzle_id:   p.id,
      fen:         p.fen,
      moves:       p.moves,
      rating:      p.rating,
      themes:      p.themes,
      phase:       p.phase,
    })),
  });
}

// POST – receive calibration results and set initial rating
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const { results } = await req.json() as { results: [number, boolean][] };

  if (!results?.length) {
    return NextResponse.json({ error: "No results" }, { status: 400 });
  }

  // Weighted average of solved puzzle ratings
  let score = 0;
  let count = 0;
  for (const [rating, solved] of results) {
    if (solved) { score += rating; count++; }
  }
  const baseRating = count > 0 ? Math.round(score / count) : 1200;
  const clampedRating = Math.max(600, Math.min(2400, baseRating));

  await supabaseAdmin.from("player_puzzle_rating").upsert({
    username,
    rating:     clampedRating,
    rd:         200,
    calibrated: true,
    streak_days: 0,
    updated_at: new Date().toISOString(),
  }, { onConflict: "username" });

  return NextResponse.json({ rating: clampedRating, calibrated: true });
}
