import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function normalize(rating: number): number {
  return Math.round(Math.min(100, Math.max(0, (rating - 400) / 24)));
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;

  const [ratingRow, themeRatings, totalOwn, progressRows, historyRows] = await Promise.all([
    prisma.player_puzzle_rating.findUnique({
      where:  { username },
      select: { rating: true, streak_days: true, calibrated: true },
    }),
    prisma.player_theme_rating.findMany({
      where:  { username },
      select: { theme: true, rating: true, attempts: true },
    }),
    prisma.puzzles.count({ where: { username } }),
    prisma.puzzle_progress.findMany({
      where:  { username },
      select: { puzzle_id: true, attempts: true, last_solved: true },
    }),
    prisma.player_rating_history.findMany({
      where:   { username },
      orderBy: { recorded_at: "desc" },
      take:    14,
      select:  { rating: true, recorded_at: true },
    }),
  ]);

  const categoryBuckets: Record<string, number[]> = {
    tactics: [], phase: [], endgame_material: [], openings: [],
  };
  const specificThemes: Record<string, number> = {};

  for (const row of themeRatings) {
    specificThemes[row.theme] = normalize(row.rating);
    const cat = categoryBuckets[row.theme];
    if (cat) cat.push(row.rating);
  }

  const accuracy_by_theme: Record<string, number> = {};
  for (const [cat, ratings] of Object.entries(categoryBuckets)) {
    if (ratings.length > 0) {
      accuracy_by_theme[cat] = normalize(
        ratings.reduce((a, b) => a + b, 0) / ratings.length,
      );
    }
  }

  const total_attempted = progressRows.filter((r) => r.attempts > 0).length;
  const total_solved    = progressRows.filter((r) => r.last_solved != null).length;

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekly_solved = progressRows.filter(
    (r) => r.last_solved != null && new Date(r.last_solved) >= weekAgo,
  ).length;

  const rating_history = [...historyRows]
    .reverse()
    .map((r) => ({
      date:   r.recorded_at?.toISOString().split("T")[0] ?? "",
      rating: Math.round(r.rating),
    }));

  return NextResponse.json({
    rating:          ratingRow?.rating     ?? 1200,
    streak_days:     ratingRow?.streak_days ?? 0,
    calibrated:      ratingRow?.calibrated  ?? false,
    total_puzzles:   totalOwn,
    total_attempted,
    total_solved,
    weekly_solved,
    solve_rate:      total_attempted > 0
      ? Math.round((total_solved / total_attempted) * 100)
      : 0,
    accuracy_by_theme,
    theme_breakdown: specificThemes,
    rating_history,
  });
}
