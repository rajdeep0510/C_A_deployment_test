import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { toCategory } from "@/lib/puzzles/theme-utils";

// Glicko-2-ish simple Elo delta
function eloChange(rating: number, puzzleRating: number, solved: boolean): number {
  const expected = 1 / (1 + Math.pow(10, (puzzleRating - rating) / 400));
  const score = solved ? 1 : 0;
  return Math.round(32 * (score - expected));
}

// Spaced repetition interval update
function nextInterval(solved: boolean, current: number, ease: number) {
  if (!solved) return { interval: 1, ease: Math.max(1.3, ease - 0.2) };
  const next = Math.round(current * ease);
  return { interval: Math.min(next, 90), ease: Math.min(ease + 0.1, 3.0) };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ username: string; puzzleId: string }> },
) {
  const { username, puzzleId } = await params;
  const body = await req.json();
  const {
    solved            = false,
    time_taken_seconds = 0,
    puzzle_rating     = 1200,
    source            = "own_game",
    puzzle_type       = "",
  } = body;

  const today = new Date().toISOString().split("T")[0];

  // ── 1. Update puzzle_progress (spaced repetition) ────────────────────────
  const { data: existing } = await supabaseAdmin
    .from("puzzle_progress")
    .select("attempts, interval_days, ease_factor")
    .eq("username", username)
    .eq("puzzle_id", puzzleId)
    .maybeSingle();

  const attempts      = (existing?.attempts ?? 0) + 1;
  const curInterval   = existing?.interval_days ?? 1;
  const curEase       = existing?.ease_factor ?? 2.5;
  const { interval, ease } = nextInterval(solved, curInterval, curEase);

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + interval);

  await supabaseAdmin.from("puzzle_progress").upsert({
    username,
    puzzle_id:     puzzleId,
    attempts,
    last_solved:   solved ? today : (existing ? undefined : null),
    next_review:   nextDate.toISOString().split("T")[0],
    interval_days: interval,
    ease_factor:   ease,
    source,
  }, { onConflict: "username,puzzle_id" });

  // ── 2. Update player overall rating ──────────────────────────────────────
  const { data: ratingRow } = await supabaseAdmin
    .from("player_puzzle_rating")
    .select("rating, rd, streak_days, last_active_date")
    .eq("username", username)
    .maybeSingle();

  const currentRating  = ratingRow?.rating ?? 1200;
  const delta          = eloChange(currentRating, puzzle_rating, solved);
  const newRating      = Math.max(400, Math.min(3200, currentRating + delta));

  // Streak logic
  const lastActive     = ratingRow?.last_active_date;
  const yesterday      = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yDate          = yesterday.toISOString().split("T")[0];
  let streakDays       = ratingRow?.streak_days ?? 0;
  if (lastActive === today) {
    /* same day, no change */
  } else if (lastActive === yDate) {
    streakDays++;
  } else {
    streakDays = 1;
  }

  await supabaseAdmin.from("player_puzzle_rating").upsert({
    username,
    rating:           newRating,
    rd:               ratingRow?.rd ?? 350,
    streak_days:      streakDays,
    last_active_date: today,
    calibrated:       true,
    updated_at:       new Date().toISOString(),
  }, { onConflict: "username" });

  // ── 3. Update per-theme rating ────────────────────────────────────────────
  const themes = [toCategory(puzzle_type), puzzle_type].filter(Boolean);
  for (const theme of themes) {
    if (!theme) continue;
    const { data: tRow } = await supabaseAdmin
      .from("player_theme_rating")
      .select("rating, rd, attempts")
      .eq("username", username)
      .eq("theme", theme)
      .maybeSingle();

    const tr      = tRow?.rating ?? 1200;
    const td      = eloChange(tr, puzzle_rating, solved);
    await supabaseAdmin.from("player_theme_rating").upsert({
      username,
      theme,
      rating:     Math.max(400, Math.min(3200, tr + td)),
      rd:         tRow?.rd ?? 350,
      attempts:   (tRow?.attempts ?? 0) + 1,
    }, { onConflict: "username,theme" });
  }

  // ── 4. Record rating history entry (once per day) ─────────────────────────
  if (lastActive !== today) {
    await supabaseAdmin.from("player_rating_history").insert({
      username,
      rating:      newRating,
      rd:          ratingRow?.rd ?? 350,
      recorded_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({
    success:      true,
    rating_delta: delta,
    new_rating:   newRating,
    streak_days:  streakDays,
  });
}
