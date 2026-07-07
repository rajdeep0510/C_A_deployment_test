import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Normalize a Glicko rating to 0-100 display scale
// 400 → 0, 1200 → 33, 2000 → 67, 2800 → 100
function normalize(rating: number): number {
  return Math.round(Math.min(100, Math.max(0, (rating - 400) / 24)));
}

const CATEGORY_LABELS: Record<string, string> = {
  tactics:          "Tactics",
  phase:            "Game Phase",
  endgame_material: "Endgame",
  openings:         "Openings",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;

  // ── Overall rating + streak ───────────────────────────────────────────────
  const { data: ratingRow } = await supabaseAdmin
    .from("player_puzzle_rating")
    .select("rating, streak_days, calibrated")
    .eq("username", username)
    .maybeSingle();

  // ── Per-theme ratings (for skill radar) ───────────────────────────────────
  const { data: themeRatings } = await supabaseAdmin
    .from("player_theme_rating")
    .select("theme, rating, attempts")
    .eq("username", username);

  // Aggregate by broad category (tactics / phase / endgame_material / openings)
  const categoryBuckets: Record<string, number[]> = {
    tactics: [], phase: [], endgame_material: [], openings: [],
  };
  const specificThemes: Record<string, number> = {};

  for (const row of themeRatings ?? []) {
    specificThemes[row.theme] = normalize(row.rating);
    const cat = categoryBuckets[row.theme];
    if (cat) cat.push(row.rating); // direct category row
  }

  const accuracy_by_theme: Record<string, number> = {};
  for (const [cat, ratings] of Object.entries(categoryBuckets)) {
    if (ratings.length > 0) {
      accuracy_by_theme[cat] = normalize(
        ratings.reduce((a, b) => a + b, 0) / ratings.length,
      );
    }
  }

  // ── Puzzle counts ──────────────────────────────────────────────────────────
  const { count: totalOwn } = await supabaseAdmin
    .from("puzzles")
    .select("*", { count: "exact", head: true })
    .eq("username", username);

  const { data: progressRows } = await supabaseAdmin
    .from("puzzle_progress")
    .select("puzzle_id, attempts, last_solved")
    .eq("username", username);

  const total_attempted = (progressRows ?? []).filter((r) => r.attempts > 0).length;
  const total_solved    = (progressRows ?? []).filter((r) => r.last_solved != null).length;

  // Weekly solved (last 7 days)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekStr = weekAgo.toISOString().split("T")[0];
  const weekly_solved = (progressRows ?? []).filter(
    (r) => r.last_solved != null && r.last_solved >= weekStr,
  ).length;

  // ── Rating history (last 14 data points) ──────────────────────────────────
  const { data: historyRows } = await supabaseAdmin
    .from("player_rating_history")
    .select("rating, recorded_at")
    .eq("username", username)
    .order("recorded_at", { ascending: false })
    .limit(14);

  const rating_history = (historyRows ?? [])
    .reverse()
    .map((r) => ({
      date:   r.recorded_at.split("T")[0],
      rating: Math.round(r.rating),
    }));

  return NextResponse.json({
    rating:            ratingRow?.rating    ?? 1200,
    streak_days:       ratingRow?.streak_days ?? 0,
    calibrated:        ratingRow?.calibrated ?? false,
    total_puzzles:     totalOwn ?? 0,
    total_attempted,
    total_solved,
    weekly_solved,
    solve_rate:        total_attempted > 0
      ? Math.round((total_solved / total_attempted) * 100)
      : 0,
    accuracy_by_theme,    // for radar: category → 0-100
    theme_breakdown: specificThemes, // specific type → 0-100
    rating_history,
  });
}
