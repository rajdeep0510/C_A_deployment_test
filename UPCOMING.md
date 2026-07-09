# Upcoming Work — Chess Advisor

Last updated: 2026-07-09

---

## Recently Shipped (July 2026)

| Feature | Branch | Notes |
|---|---|---|
| Blunder Clinic — interactive board review | `feature/blunder-clinic` | `fen_before` + `full_history` reconstruction; has_boards flag |
| Opening Drill page (`/openings/drill`) | `feature/opening-drill` | 45 openings, ELO 600–2400 |
| Drill — ELO calibration fix | `feature/opening-drill` | Below 1320: Skill Level + short movetime instead of flat 400ms |
| Drill — Takeback & Hint training aids | `feature/opening-drill` | Toggleable in setup panel |
| Drill — Save PGN + WASM analysis | `feature/opening-drill` | Post-game accuracy %, move quality, best-move suggestions |
| Move log during play | `feature/opening-drill` | Always visible; last 6 half-moves |
| Chessboard import fix (CJS → ESM) | `feature/opening-drill` | Static import replaces broken `dynamic()` |

---

## Priority 1 — Next to Build

### 1. Doubt Feature — Phase 1 (Board Editor + Claude Q&A)

**What:** Player sets up any position (FEN paste, PGN paste, or drag-to-place editor), asks a plain-English question, gets a Claude answer grounded in Stockfish evaluation.

**Why now:** Opening Drill proved the WASM eval loop works well in the browser. The Doubt feature reuses that exact infrastructure — no new engine work needed. The only new pieces are the board editor UI and the Claude streaming API route.

**Scope:**
- `/doubts` page with board editor (react-chessboard already in stack)
- FEN paste + PGN paste inputs
- Background WASM eval (top 3 lines, depth ~15, reuse `useDrillEngine` or engine pool)
- `POST /api/doubt` → Claude claude-sonnet-5 with FEN + engine lines + user question → streamed response
- Supabase `doubts` table for history (optional for v1, nice to have)

**Key constraint:** Always show a confidence/fallback path when position is ambiguous. If the position has no legal moves or Stockfish returns mate-in-1, surface that context to Claude so answers aren't misleading.

**Files to create/modify:**
- `apps/web/src/app/doubts/page.tsx` (new)
- `apps/web/src/app/api/doubt/route.ts` (new)
- `apps/web/src/hooks/usePositionEval.ts` (new — thin wrapper around engine for one-shot eval)

---

### 2. Merge `feature/blunder-clinic` → `dev`

The blunder clinic and Python worker fixes (fen_before, full_history) are sitting on `feature/blunder-clinic`. Once the teammate's UI work on `dev` is stable, merge this in. The Python worker also needs a redeploy from this branch for `fen_before` to populate on new batch runs.

**Checklist before merge:**
- [ ] Teammate confirms `dev` UI is stable
- [ ] Redeploy Python worker from `feature/blunder-clinic`
- [ ] Run one fresh batch analysis — verify boards appear in Blunder Clinic
- [ ] Merge `feature/blunder-clinic` → `dev`, then `feature/opening-drill` → `dev`

---

## Priority 2 — UX Gaps Still Open

### 3. Stale cached analysis results (re-analyze button)
- **Problem**: Games analyzed before the `PositionUtils.detect_game_phase` fix have empty `move_history`, no `time_analysis`, no `patterns` in Supabase.
- **Fix**: "Re-analyze" button on `analysis/[filename]/page.tsx` that invalidates the Supabase row and re-triggers the analysis job.
- **Files**: `apps/web/src/app/analysis/[filename]/page.tsx`, `apps/web/src/app/api/analyze/route.ts`

### 4. Openings tab always shows "not available" on single-game analysis
- **Problem**: `opening_recommendation` is a batch-level concept — single-game analysis never returns it.
- **Fix (preferred)**: Replace the tab content with what we actually have: `opening_name`, `eco_code`, and the first ~10 book moves from `move_history`.
- **Files**: `apps/web/src/app/analysis/[filename]/page.tsx`

### 5. No progress indicator on single-game WASM analysis
- **Problem**: Analysis takes 30–60s with only a generic spinner.
- **Fix**: Surface move-by-move callbacks to a progress state: "Analyzing move 23 / 48".
- **Files**: `apps/web/src/services/local-analysis.ts`, `apps/web/src/app/analysis/[filename]/page.tsx`

### 6. Old localStorage `_v1` keys never cleaned up
- **Problem**: Dashboard cache was versioned `_v1` → `_v2` on the win-rate fix; `_v1` keys remain in every user's localStorage.
- **Fix**: On dashboard load, delete `stats_{username}_v1` and `realStats_{username}_v1`.
- **Files**: `apps/web/src/app/dashboard/page.tsx`

---

## Priority 3 — Needs Verification

### 7. Puzzle system end-to-end
- **Problem**: Spaced repetition + timed rush modes built but never fully verified with real data.
- **Action**: Run through a complete puzzle session; confirm progress saves and loads correctly across sessions.

### 8. Report page with live batch data
- **Action**: Navigate to `/report` after a fresh batch completes and verify all sections render (accuracy, phase radar, opening table, time pressure, opponent opening loss).

---

## Priority 4 — Debt / Nice-to-Have

### 9. `getStats` runs on every dashboard load
- **Fix**: Cache alongside the other dashboard keys; skip on cache-hit.
- **Files**: `apps/web/src/app/dashboard/page.tsx`

### 10. Worker `.env` not committed / no setup guide
- **Fix**: Add `.env.example` with placeholder values; document in `ARCHITECTURE_WORKER.md`.
- **Files**: `apps/stockfish-worker/.env.example`, `apps/stockfish-worker/ARCHITECTURE_WORKER.md`

### 11. Drill ELO accuracy note
- Stockfish cannot simulate below ~700 ELO precisely (UCI_Elo minimum is 1320; we approximate with Skill Level 0 + 30ms movetime). Consider adding a tooltip on the 600 preset: "Approx. 700 ELO — Stockfish's practical floor."
- **Files**: `apps/web/src/app/openings/drill/page.tsx`

---

## Doubt Feature — Phase 2 (Future, No Timeline Yet)

Photo-to-FEN via the YOLOv8 piece detection model (already prototyped). Becomes an additional input method on the `/doubts` page once Phase 1 is stable. See `PRODUCT_VISION.md` for full spec.

Key open questions before starting Phase 2:
- What accuracy threshold do we require before shipping? (Proposed: >90% piece accuracy on standard Staunton sets)
- Where does inference run — browser (ONNX) or server-side (Python endpoint)?
- How do we handle board orientation detection?
