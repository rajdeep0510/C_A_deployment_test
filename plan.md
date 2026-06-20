# WASM Stockfish Engine Integration — Plan B

## Goal
Integrate Chesskit's client-side WASM Stockfish 18 as the primary analysis engine in `apps/web`, falling back to the Python worker only for deep insights (tactical/patterns/time analysis). No frontend UI changes.

## Progress

### ✅ Completed (Research & Planning)
- Explored full Chesskit codebase: engine files, helpers, types, enums, openings data, chess utilities
- Explored `apps/web` structure: analysis page, API routes, services, lib, dashboard, coach pages
- Identified that `analyzeGame()` in `api.ts` calls `/api/analyze/{username}/{filename}` which has no matching route
- Traced the `filename` field: comes from the existing API response (games list → `game.filename` → URL param)
- Read all Chesskit engine source files:
  - `uciEngine.ts` (431 lines) — multi-worker UCI manager
  - `worker.ts` — Web Worker creation + UCI command lifecycle
  - `shared.ts` — WASM detection, device detection
  - `stockfish18.ts` — Stockfish 18 factory
  - `helpers/parseResults.ts` — parse engine output lines
  - `helpers/moveClassification.ts` — quality labeling (Splendid→Brilliant, etc.)
  - `helpers/accuracy.ts` — per-player accuracy computation
  - `helpers/estimateElo.ts` — performance rating from CPL
  - `helpers/winPercentage.ts` — CP→win% conversion (Lichess sigmoid)
  - `Chesskit/src/lib/chess.ts` — `formatUciPv`, `getIsPieceSacrifice`, `isSimplePieceRecapture`, `getMaterialDifference`
  - `Chesskit/src/lib/math.ts` — `ceilsNumber`, `getHarmonicMean`, `getWeightedMean`, `getStandardDeviation`
  - `Chesskit/src/types/eval.ts` — `PositionEval`, `LineEval`, `GameEval`, `Accuracy`, etc.
  - `Chesskit/src/types/engine.ts` — `EngineWorker`, `WorkerJob`
  - `Chesskit/src/types/enums.ts` — `EngineName`, `MoveClassification`
  - `Chesskit/src/data/openings.ts` — 13,606 FEN→opening name entries
- Analyzed expected analysis schema from `page.tsx` usage (move_history quality labels, full_history format, phase_accuracy, etc.)
- Confirmed WASM binaries exist at `Chesskit/public/engines/stockfish-18/` (9 files, ~80MB total)
- Confirmed quality mapping: Splendid→Brilliant, Perfect→Best, Best→Best, Excellent→Excellent, Okay→Good, Inaccuracy→Inaccuracy, Mistake→Mistake, Blunder→Blunder, Opening→Book, Forced→Forced
- Confirmed `time_analysis` and `patterns` can be `null` in WASM path (frontend handles gracefully)
- Confirmed ECO code from PGN headers `[ECO "..."]`
- Confirmed env vars: `NEXT_PUBLIC_ANALYSIS_ENABLE_WASM`, `NEXT_PUBLIC_ANALYSIS_ENGINE_DEPTH`, `NEXT_PUBLIC_ANALYSIS_MULTIPV`, `NEXT_PUBLIC_ANALYSIS_MAX_WORKERS`
- Selected **Plan B** (WASM-only, error if unsupported)

### ✅ Completed (Implementation)

All 13 new files created, 2 files modified, 9 WASM binaries copied, configs updated — build passes.

| # | File | Status |
|---|------|--------|
| 1 | `src/types/engine-types.ts` | ✅ Types (enums, interfaces, QUALITY_MAP) |
| 2 | `src/lib/engine/helpers/math.ts` | ✅ `ceilsNumber`, `getHarmonicMean`, `getWeightedMean`, `getStandardDeviation` |
| 3 | `src/lib/engine/helpers/win-percentage.ts` | ✅ CP→win% Lichess sigmoid formula |
| 4 | `src/lib/engine/helpers/parse-results.ts` | ✅ Engine output parser with `formatUciPv` castling fix inlined |
| 5 | `src/lib/engine/wasm-detect.ts` | ✅ `isWasmSupported`, `isMobileDevice`, `getRecommendedWorkersNb` |
| 6 | `src/lib/engine/worker-loader.ts` | ✅ `getEngineWorker`, `sendCommandsToWorker` |
| 7 | `src/lib/engine/stockfish-loader.ts` | ✅ `getStockfish18Path`, `getBestEnginePath` |
| 8 | `src/lib/engine/helpers/move-classification.ts` | ✅ Full classification (Splendid→Brilliant, Perfect→Best, etc.) with `getIsPieceSacrifice` and `isSimplePieceRecapture` inlined |
| 9 | `src/lib/engine/helpers/accuracy.ts` | ✅ Weighted mean + harmonic mean per-player accuracy |
| 10 | `src/lib/engine/helpers/estimate-elo.ts` | ✅ CPL→ELO estimation anchored to actual rating |
| 11 | `src/lib/engine/engine-pool.ts` | ✅ Multi-worker UCI engine pool (adapted from Chesskit's UciEngine) |
| 12 | `src/lib/engine/openings.ts` | ✅ Copied from Chesskit (13,606 FEN→name entries) |
| 13 | `src/lib/engine-config.ts` | ✅ Reads env vars with defaults |
| 14 | `src/services/local-analysis.ts` | ✅ Orchestrator: PGN fetch → parse → engine → schema mapper |
| 15 | `src/services/api.ts` | **Modified** — `analyzeGame()` tries WASM first, falls back to server |
| 16 | `.env` | **Modified** — added 5 engine env vars |
| 17 | `next.config.mjs` | **Modified** — added WASM cache headers |
| 18 | `public/engines/stockfish-18/` | ✅ 9 WASM binary files copied (~117MB) |

### Build Result
- ✅ Compiled successfully (Next.js 16.2.6 + Turbopack)
- All routes compile including `analysis/[filename]` and `coach/players/[username]/analysis/[filename]`

### Key Implementation Details
- `analyzeGame()` in `api.ts` dynamically imports WASM modules on client-side check (`typeof window !== "undefined"`)
- PGN fetching: detects Lichess game IDs (8-char) and Chess.com game IDs via archive search
- Phase detection: opening (moves 1-10), endgame (≤6 non-pawn pieces), middlegame otherwise
- Quality mapping via `QUALITY_MAP` enum-to-string table
- `time_analysis` and `patterns` set to `null` (frontend handles gracefully)

### Key Design Decisions
- `formatUciPv` castling fix logic will be inlined in `parse-results.ts` (it's small, avoids importing Chesskit's chess.ts)
- `getIsPieceSacrifice` and `isSimplePieceRecapture` will be inlined in `move-classification.ts` (same reason)
- Openings data (`FEN→name` array) will be embedded in a local file (13,606 entries, ~800KB)
- PGN fetching uses Chess.com `/pub/player/{username}/games/{year}/{month}` API or Lichess `/game/export/{id}` based on filename pattern detection
- No changes to any UI component (`page.tsx`, `MistakeCard`, `PatternGrid`, `TimeAnalysisCard`)
