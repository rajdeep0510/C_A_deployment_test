import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toCategory } from "@/lib/puzzles/theme-utils";

function eloChange(rating: number, puzzleRating: number, solved: boolean): number {
  const expected = 1 / (1 + Math.pow(10, (puzzleRating - rating) / 400));
  const score = solved ? 1 : 0;
  return Math.round(32 * (score - expected));
}

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
    solved             = false,
    time_taken_seconds = 0,
    puzzle_rating      = 1200,
    source             = "own_game",
    puzzle_type        = "",
  } = body;

  const today = new Date().toISOString().split("T")[0];

  // ── 1. Update puzzle_progress (spaced repetition) ────────────────────────
  const existing = await prisma.puzzle_progress.findUnique({
    where:  { username_puzzle_id: { username, puzzle_id: puzzleId } },
    select: { attempts: true, interval_days: true, ease_factor: true },
  });

  const attempts    = (existing?.attempts ?? 0) + 1;
  const curInterval = existing?.interval_days ?? 1;
  const curEase     = existing?.ease_factor ?? 2.5;
  const { interval, ease } = nextInterval(solved, curInterval, curEase);

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + interval);

  await prisma.puzzle_progress.upsert({
    where:  { username_puzzle_id: { username, puzzle_id: puzzleId } },
    create: {
      username,
      puzzle_id:     puzzleId,
      attempts,
      last_solved:   solved ? new Date(today) : null,
      next_review:   nextDate,
      interval_days: interval,
      ease_factor:   ease,
      source,
    },
    update: {
      attempts,
      last_solved:   solved ? new Date(today) : undefined,
      next_review:   nextDate,
      interval_days: interval,
      ease_factor:   ease,
    },
  });

  // ── 2. Update player overall rating ──────────────────────────────────────
  const ratingRow = await prisma.player_puzzle_rating.findUnique({
    where:  { username },
    select: { rating: true, rd: true, streak_days: true, last_active_date: true },
  });

  const currentRating = ratingRow?.rating ?? 1200;
  const delta         = eloChange(currentRating, puzzle_rating, solved);
  const newRating     = Math.max(400, Math.min(3200, currentRating + delta));

  const lastActiveStr = ratingRow?.last_active_date?.toISOString().split("T")[0] ?? null;
  const yesterday     = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yDate         = yesterday.toISOString().split("T")[0];
  let streakDays      = ratingRow?.streak_days ?? 0;
  if (lastActiveStr === today) {
    /* same day */
  } else if (lastActiveStr === yDate) {
    streakDays++;
  } else {
    streakDays = 1;
  }

  await prisma.player_puzzle_rating.upsert({
    where:  { username },
    create: {
      username,
      rating:           newRating,
      rd:               ratingRow?.rd ?? 350,
      streak_days:      streakDays,
      last_active_date: new Date(today),
      calibrated:       true,
      updated_at:       new Date(),
    },
    update: {
      rating:           newRating,
      streak_days:      streakDays,
      last_active_date: new Date(today),
      calibrated:       true,
      updated_at:       new Date(),
    },
  });

  // ── 3. Update per-theme rating ────────────────────────────────────────────
  const themes = [toCategory(puzzle_type), puzzle_type].filter(Boolean);
  for (const theme of themes) {
    if (!theme) continue;
    const tRow = await prisma.player_theme_rating.findUnique({
      where:  { username_theme: { username, theme } },
      select: { rating: true, rd: true, attempts: true },
    });

    const tr = tRow?.rating ?? 1200;
    const td = eloChange(tr, puzzle_rating, solved);
    await prisma.player_theme_rating.upsert({
      where:  { username_theme: { username, theme } },
      create: {
        username,
        theme,
        rating:   Math.max(400, Math.min(3200, tr + td)),
        rd:       tRow?.rd ?? 350,
        attempts: (tRow?.attempts ?? 0) + 1,
      },
      update: {
        rating:   Math.max(400, Math.min(3200, tr + td)),
        rd:       tRow?.rd ?? 350,
        attempts: (tRow?.attempts ?? 0) + 1,
      },
    });
  }

  // ── 4. Record rating history entry (once per day) ─────────────────────────
  if (lastActiveStr !== today) {
    await prisma.player_rating_history.create({
      data: {
        username,
        rating:      newRating,
        rd:          ratingRow?.rd ?? 350,
        recorded_at: new Date(),
      },
    });
  }

  return NextResponse.json({
    success:      true,
    rating_delta: delta,
    new_rating:   newRating,
    streak_days:  streakDays,
  });
}
