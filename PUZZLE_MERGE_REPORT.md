# Puzzle Algo Merge Report

**Date:** 2026-06-30
**Source branch:** `puzzle_algo`
**Target branch:** `main` (via `feature/puzzle-algo`)

---

## Summary

The `puzzle_algo` branch was an orphan branch (no shared git history with `main`).
Rather than rebasing, we cloned `puzzle_algo` into a separate folder and manually
ported only the files that were unique to it.

During comparison, every file that existed in **both** branches was found to be more
advanced in `main` — `main` had received bug fixes and improvements that `puzzle_algo`
never received. So no shared files were modified.

---

## What Was Changed (New Files Added to Main)

These files did not exist in `main` at all and were copied directly from `puzzle_algo`.

### Puzzle Algorithm Scripts — `apps/web/puzzle_algo/`
| File | Description |
|------|-------------|
| `build_chunks.mjs` | Script to chunk puzzle CSV data by rating range |
| `seed_puzzles.mjs` | Script to seed puzzles into the database |
| `cli.py` | CLI tool for puzzle management |
| `puzzle_game_hook.tsx` | React hook for puzzle game state |
| `requirements.txt` | Python dependencies for puzzle scripts |
| `SESSION_MIGRATION_SUMMARY.md` | Docs on session migration |
| `working_analogy.md` | Dev notes on puzzle architecture |

### Puzzle Dataset — `apps/web/puzzle_data/`
62 gzipped CSV files containing Lichess puzzles chunked by rating range:
- `rating_0200-0400.csv.gz`
- `rating_0400-0600_part1.csv.gz` through `part2`
- `rating_0600-0800_part1.csv.gz` through `part3`
- `rating_0800-1000_part1.csv.gz` through `part6`
- `rating_1000-1200_part1.csv.gz` through `part7`
- `rating_1200-1400_part1.csv.gz` through `part6`
- `rating_1400-1600_part1.csv.gz` through `part6`
- `rating_1600-1800_part1.csv.gz` through `part5`
- `rating_1800-2000_part1.csv.gz` through `part5`
- `rating_2000-2200_part1.csv.gz` through `part4`
- `rating_2200-2400_part1.csv.gz` through `part3`
- `rating_2400-2600_part1.csv.gz` through `part2`
- `rating_2600-2800_part1.csv.gz` through `part2`
- `rating_2800-3000.csv.gz`
- `rating_3000-3200.csv.gz`
- `rating_3200-3400.csv.gz`

### Puzzle API Routes — `apps/web/src/app/api/puzzles/`
| File | Description |
|------|-------------|
| `library/route.ts` | API endpoint for fetching puzzles from the Lichess library |
| `rush/route.ts` | API endpoint for puzzle rush mode |

### Puzzle Library Loader — `apps/web/src/lib/puzzles/`
| File | Description |
|------|-------------|
| `chunks.ts` | Loads the correct gzipped puzzle chunk based on player rating |

---

## What Was NOT Changed (Kept Main's Version)

These files exist in both branches but were **intentionally left as main's version**
because main's code was more advanced in every case.

| File | Reason main's version was kept |
|------|-------------------------------|
| `apps/web/src/app/puzzles/page.tsx` | Main has better fallback logic (falls back to library if "own" source fails) and more UI polish (animations, larger fonts) |
| `apps/web/src/app/dashboard/page.tsx` | Main has batch progress tracking, fetch panel UI, and localStorage stats caching that `puzzle_algo` was missing |
| `apps/web/src/services/api.ts` | Main has Supabase analysis caching, `getBatchStatus` function, and a higher default batch limit (50 vs 5) |
| `apps/web/src/services/local-analysis.ts` | Main uses win probability (0–100 scale) instead of raw eval; better graph data with opponent move quality |
| `apps/web/src/app/analysis/[filename]/page.tsx` | Main has stricter Chess.com URL matching, searches 12 months of archives, and passes win probability to move history |
| `apps/web/src/app/globals.css` | Main has more glass card effects, extra keyframes (`pulse-glow`, `slideInRight`), and more refined CSS variables |
| `apps/web/src/components/GameCard.tsx` | Main has proper `resolveOutcome()` function and encoded filename in href — `puzzle_algo` had a placeholder comment instead |
| `apps/web/src/components/GameCard.css` | Main has text overflow handling (`ellipsis`, `nowrap`) |
| `apps/web/src/app/api/analyze/route.ts` | Main deduplicates completed jobs and has a `PATCH` endpoint for saving results — `puzzle_algo` was missing both |
| `apps/web/src/lib/chess/integrations.ts` | Main normalises results to `1-0`/`0-1`/`1/2-1/2`, adds `filename` field, and uses optional chaining for safety |
| `apps/stockfish-worker/worker.py` | Main has `BatchAnalyzer`, structured logging, stuck-job timeout, and retry logic — `puzzle_algo` had a simpler version |
| `packages/types/src/index.ts` | Identical in both branches — no change needed |
| `package.json` (root + web) | Identical in both branches — no new dependencies required |

---

## What Was Skipped Entirely

| Path | Reason |
|------|--------|
| `apps/stockfish-worker/venv/` | Python virtual environment — never committed, 3400+ noise files |
| `apps/stockfish-worker/__pycache__/` | Compiled bytecode — not committed |
| `puzzle_algo_code/` | The local clone folder used for comparison — not part of the project |

---

## Current State

- Branch: `feature/puzzle-algo`
- Files staged: all new puzzle files listed above
- No commit made yet — awaiting your review and approval
