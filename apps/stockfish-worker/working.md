# Stockfish Worker — Complete Working Context

## Overview

The Stockfish Worker is a standalone Python service that performs heavy chess analysis using the [Stockfish](https://stockfishchess.org/) engine. It operates asynchronously by polling a job queue (Supabase `analysis_jobs` table), running per-move Stockfish evaluations on PGN game data, and writing structured analysis results back to the database and disk cache.

It is deployed alongside a **Next.js** frontend that inserts analysis jobs and polls for completion.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                Next.js App Router                        │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Inserts row → public.analysis_jobs (status:       │  │
│  │  'pending') with username + filename               │  │
│  │                                                    │  │
│  │  Polls job status until 'completed' / 'failed'     │  │
│  └────────────────────────────────────────────────────┘  │
└────────────────────────┬─────────────────────────────────┘
                         │ Supabase (PostgreSQL)
                         ▼
┌──────────────────────────────────────────────────────────┐
│              Stockfish Worker (worker.py)                 │
│                                                           │
│  ┌──────────┐   ┌────────────────────────────────────┐  │
│  │          │   │  worker_core/                       │  │
│  │ worker.py│──▶│  ├── engine_manager.py  (Stockfish) │  │
│  │ (polling)│   │  ├── game_analyzer.py   (per-game)  │  │
│  │          │   │  ├── batch_analyzer.py  (N games)   │  │
│  └──────────┘   │  ├── move_classifier.py (quality)   │  │
│                  │  ├── tactical_validator.py          │  │
│                  │  ├── training_plan.py               │  │
│                  │  ├── win_rate.py                    │  │
│                  │  ├── analysis_storage.py  (JSON)    │  │
│                  │  └── cache_manager.py    (memory)   │  │
│                  └────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## Module Breakdown

### Entry Point — `worker.py`

- Polls `public.analysis_jobs` every 5 seconds for rows where `status='pending'`
- Calls `process_job()` for each job:
  1. Updates status → `processing`
  2. (Placeholder) Fetches PGN → runs `GameAnalyzer.analyze_pgn()` or `BatchAnalyzer`
  3. Updates status → `completed` (or `failed`) with JSON result
- Currently has a **mock placeholder** (`time.sleep(5)` + hardcoded result) — the actual analysis code is ready in `worker_core/` but not wired in yet.

### Configuration — `worker_config.py`

Uses **Pydantic Settings v2** to load from `.env`:

| Setting | Default | Purpose |
|---|---|---|
| `SUPABASE_URL` | `""` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | `""` | Service-role key (secret) |
| `STOCKFISH_PATH` | `"stockfish"` | Path to Stockfish binary |
| `ANALYSIS_NODES` | `500_000` | Nodes per position evaluation |
| `ANALYSIS_TIME` | `0.1` | *(legacy)* Time per move |
| `ENGINE_THREADS` | `1` | Threads per engine |
| `ENGINE_HASH_MB` | `64` | Hash table size |
| `MAX_CONCURRENT_ENGINES` | `1` | Max parallel Stockfish processes |
| `ENGINE_ACQUIRE_TIMEOUT` | `30` | Seconds to wait for engine slot |
| `CHESS_COM_BASE_URL` | `https://api.chess.com/pub/player` | Chess.com API base |
| `LICHESS_BASE_URL` | `https://lichess.org/api` | Lichess API base |
| `REQUEST_TIMEOUT` | `10` | HTTP fetch timeout |
| `GAMES_DATA_DIR` | `data/games/` | PGN storage |
| `REPORTS_DATA_DIR` | `data/reports/` | Report output |
| `ANALYSIS_CACHE_DIR` | `data/analysis/` | JSON cache |
| `MAX_BATCH_SIZE` | `50` | Max games per batch |

Directories are created at import time automatically.

### `worker_core/engine_manager.py` — Stockfish Process Lifecycle

- **`EngineManager`**: wraps `chess.engine.SimpleEngine.popen_uci()`
  - `start()` — launches the Stockfish subprocess
  - `stop()` — terminates the engine
  - `evaluate_position(board, multipv, cache)` — evaluates a position:
    - Checks `PositionCache` (Zobrist hash) before calling engine
    - Runs engine with `chess.engine.Limit(nodes=settings.ANALYSIS_NODES)`
    - Returns list of dicts: `{eval_cp, move, move_san}` for each PV line
    - `multipv=1` returns single best line; `multipv=2` returns best + second best (used for "only move" detection)

### `worker_core/engine_semaphore.py` — Concurrency Control

- Module-level `asyncio.Semaphore(settings.MAX_CONCURRENT_ENGINES)`
- Ensures at most N Stockfish processes run simultaneously (default: 1)

### `worker_core/game_analyzer.py` — Single-Game Analysis

**Main orchestrator.** Flow for one game:

1. **Parse PGN** via `chess.pgn.read_game()`
2. **Determine user color** from `White`/`Black` headers matching `user_username`
3. **Extract opponent ELO** and **game result** (win/loss/draw from user's POV)
4. **Identify opening** — uses `OpeningDB` fallback: walks up to 15 moves, matches by Zobrist hash
5. **Move loop** (per move in the game):
   - **Pre-move eval**: `engine.evaluate_position(board, multipv=2)` with cache
   - Detect **best move**, **only move** (second best ≥100cp worse), and **sacrifice**
   - Convert eval to **White-centric CP** for calculations
   - Push the move on the board
   - **Post-move eval**: `engine.evaluate_position(...)` — also serves as next iteration's pre-move
   - Compute **CP loss**, **win-prob drop**, **move accuracy**
   - For user moves:
     - **Book detection** via `OpeningDB.is_book_position()`
     - **Quality classification** (see below)
     - **Error nature heuristics** (time pressure, opening knowledge, etc.)
     - **Tactical validation** (tactical_validator.py)
     - Book moves scoring ~100% are excluded from accuracy average
6. **Game accuracy** = average of all non-book, non-forced move accuracies
7. **Performance rating** — anchored to opponent ELO:
   - Win: quadratic bonus up to +300
   - Loss: linear penalty (−4 per % below 100%)
   - Draw: small delta (±2 per point above/below 50%)
8. **Assemble output** — includes move_history, time_analysis, patterns, mistakes categorization

**Output structure:**
```json
{
  "analysis_version": 2,
  "metadata": { /* PGN headers */ },
  "user_color": "white" | "black",
  "user_result": "win" | "loss" | "draw",
  "white_player": "...",
  "black_player": "...",
  "white_rating": "1500",
  "black_rating": "1600",
  "performance_rating": 1720,
  "opening_name": "Sicilian Defense",
  "eco_code": "B20",
  "game_accuracy": 82.5,
  "opp_accuracy": 75.3,
  "move_history": [ /* per-move analysis */ ],
  "full_history": [ /* {san, is_user} only */ ],
  "time_analysis": { /* TimeAnalyzer result */ },
  "patterns": { /* PatternAggregator result */ },
  "mistakes": {
    "categories": { /* MistakeCategorizer */ },
    "critical_moments": [ /* CriticalMoments */ ],
    "frequency": { /* MistakeFrequency */ }
  }
}
```

### `worker_core/batch_analyzer.py` — Batch Analysis

Handles analysis of **multiple games** for aggregated statistics:

- `analyze_directory(path, username, limit)` — scans `.pgn` files sorted by numeric suffix, newest first
- Uses **3-tier caching**:
  1. **Batch report cache** — if no PGN is newer than the stored report, return immediately
  2. **Incremental update** — loads old raw results, only analyzes files not in cache
  3. **Per-game JSON cache** — via `AnalysisStorage`
- Merges new + old results, then **aggregates**:
  - Average accuracy
  - Move quality distribution (counts per label)
  - Phase performance (opening/middlegame/endgame)
  - **Trend analysis** (`PerformanceTrendAnalyzer`)
  - **Opening analysis** (repertoire, performance, mistakes, recommendations, opponent losses)
  - **Pattern aggregation**
  - **Mistake frequency**
  - **Move breakdown** — every user move grouped by quality label with game context

### `worker_core/move_classifier.py` — Move Quality Classification

**Dual-gate system**: both CP loss AND win-prob drop must exceed thresholds.

| Quality | CP Loss | Win-Prob Drop | Conditions |
|---|---|---|---|
| **Forced** | — | — | Only legal move (second best ≥100cp worse) |
| **Brilliant** | — | — | Best move + sacrifice |
| **Best** | — | — | Played the engine's top move |
| **Excellent** | <10 | — | |
| **Good** | ≥10 | — | |
| **Inaccuracy** | ≥50 | ≥3% | Both gates must pass |
| **Mistake** | ≥100 | ≥7% | Both gates must pass |
| **Blunder** | ≥200 | ≥15% | Both gates must pass |

**Error nature heuristics** (`identify_error_nature`):
| Condition | Label |
|---|---|
| CP loss < 50 | `"None"` |
| Time < 5s | `"Time Pressure"` |
| Opening + CP ≥ 100 | `"Opening Knowledge"` |
| Endgame + CP ≥ 100 | `"Endgame Technique"` |
| CP ≥ 200 | `"Tactical Oversight"` |
| Default | `"Positional Misjudgment"` |

### `worker_core/tactical_validator.py` — Tactical Error Detection

Detects the specific tactical reason for a mistake/blunder (only fires when CP loss ≥ 100):

| Detection | Method |
|---|---|
| **Hanging Piece** | After the move, any of user's pieces are attacked by lower-value piece or undefended |
| **Missed Fork** | Best move forks 2+ targets (higher-value or undefended); user's move doesn't |
| **Missed Back Rank Mate** | Best move delivers checkmate or threatens back-rank checkmate |
| **Missed Pin** | Best move creates an absolute pin to the opponent's king |
| **Missed Skewer** | Best move creates a skewer (higher-value piece in front of lower-value piece on same ray) |
| **Missed Discovered Attack** | Best move uncovers an attack from a sliding piece behind it |
| **Promotion Error** | In endgame, player had a pawn on the 7th rank but didn't push it |

### `worker_core/training_plan.py` — Training Plan Generator

Aggregates suggestions from `StudySuggestions`, `OpeningSuggestions`, and `PuzzleGenerator` into a personalized plan:
- Overall strategy based on average accuracy (<60% → "Solidify Foundations", <75% → "Sharpen Tactics", else → "Refine Strategic/Endgame")
- Study focus areas
- Opening adjustments
- Recommended puzzle themes
- Estimated training time

### `worker_core/win_rate.py` — Win Rate Analyzer

Scans PGN headers from a user's directory and computes:
- Total games, overall win rate
- Split by color (white/black win/loss/draw rates)
- Time control performance
- Termination reason distribution

### `worker_core/analysis_storage.py` — JSON Cache Layer

- **`CURRENT_ANALYSIS_VERSION = 2`** — increment when pipeline changes
- Individual game analysis → `data/analysis/{username}/{filename}.json`
- Batch reports → `data/analysis/{username}/_batch_{limit}.json`
- Raw results for incremental updates → `data/analysis/{username}/_raw_{limit}.json`
- **Freshness check**: cached analysis is reused only if JSON mtime ≥ PGN mtime
- **Version check**: results with `analysis_version < CURRENT_ANALYSIS_VERSION` are discarded
- Corrupted JSON files are auto-deleted to force re-analysis

### `worker_core/cache_manager.py` — In-Memory Cache (Placeholder)

Simple `dict`-based cache. Intended as a placeholder for Redis/Memcached in production.

### `utils/position_utils.py` — Board Utilities

- `is_hanging(board, square)` — returns True if a piece is attacked by an opponent piece AND is either undefended or attacked by a lower-value piece

---

## Data Flow — Detailed

### Single Game Analysis
```
1. Next.js → INSERT INTO analysis_jobs (status='pending', username, filename)
2. worker.py polls → SELECT * FROM analysis_jobs WHERE status='pending' ORDER BY created_at LIMIT 1
3. worker.py → UPDATE analysis_jobs SET status='processing' WHERE id = job_id
4. GameAnalyzer.analyze_pgn(pgn_text, username)
   ├── EngineManager.start()  →  Stockfish subprocess launched
   ├── chess.pgn.read_game()  →  parse PGN
   ├── Evaluate starting position (multipv=2, with cache)
   ├── For each move:
   │   ├── Use cached eval from previous iteration
   │   ├── Detect best/only/sacrifice
   │   ├── Push move
   │   ├── Evaluate new position (multipv=2, cached)
   │   ├── Compute CP loss, win-prob drop, accuracy
   │   ├── Classify quality (move_classifier.py)
   │   ├── Detect tactical error (tactical_validator.py)
   │   └── Save per-move data
   ├── Compute game accuracy, performance rating
   └── Return structured result
5. worker.py → UPDATE analysis_jobs SET status='completed', result = {...} WHERE id = job_id
```

### Batch Analysis Flow
```
1. BatchAnalyzer.analyze_directory(path, username, limit)
   ├── Check batch_report cache (by mtime comparison)
   │   └── If fresh → return immediately
   ├── Load old raw results → determine which files are new
   ├── For each new file:
   │   ├── Check per-game JSON cache (by mtime + version)
   │   └── If stale/missing → run GameAnalyzer.analyze_game()
   ├── Merge new + old results
   ├── Aggregate: trends, openings, patterns, mistakes, breakdown
   ├── Save batch_report + batch_raw to disk
   └── Return aggregated report
```

---

## Move Quality Taxonomy (used across frontend)

| Label | Meaning | Frontend Color |
|---|---|---|
| `Brilliant` | Best move + sacrifice | Purple/✨ |
| `Best` | Engine's top move | Green |
| `Excellent` | Within 10cp of best | Dark green |
| `Good` | Within 10–50cp | Light green |
| `Book` | Known opening theory (quality overridden) | Blue |
| `Forced` | Only legal move on the board | Gray |
| `Inaccuracy` | 50+ CP loss + 3%+ win-prob drop | Yellow |
| `Mistake` | 100+ CP loss + 7%+ win-prob drop | Orange |
| `Blunder` | 200+ CP loss + 15%+ win-prob drop | Red |

---

## Storage & Caching Strategy

### Disk Layout
```
data/
├── analysis/          → JSON analysis cache
│   └── {username}/
│       ├── {game}.json         → per-game analysis
│       ├── _batch_{N}.json     → aggregated batch report
│       └── _raw_{N}.json       → raw per-game results for incremental updates
├── games/             → PGN files (source)
│   └── {username}/
│       └── *.pgn
└── reports/           → Generated reports (PDFs, etc.)
```

### Cache Hierarchy (fastest → slowest)
1. **Batch report** — full aggregate; invalidated if any PGN is newer
2. **Raw results** — per-game results saved during last batch; enables incremental updates
3. **Per-game JSON** — individual analysis with version check
4. **Position cache** — in-memory Zobrist hash → evaluation; shared across all games in the process (heavily reduces engine calls for common opening positions)

### Concurrency
- **1 Stockfish engine** per process (configurable, but Render free tier demands 1)
- `asyncio.Semaphore` for async servers (FastAPI endpoints)

---

## Incomplete / Stub Modules

Several file paths referenced in `import` statements are **empty (0 bytes)** or don't exist. The code will fail at runtime until these are implemented:

| Import Path | Status |
|---|---|
| `config.thresholds` — `ANALYSIS_THRESHOLDS` | **Missing** (no `config/` directory) |
| `metrics.accuracy_metrics` — `calculate_centipawn_loss`, `calculate_move_accuracy`, `calculate_win_prob_drop` | Empty file |
| `metrics.time_analysis` — `TimeAnalyzer` | Empty file |
| `metrics.performance_trends` — `PerformanceTrendAnalyzer` | Empty file |
| `patterns.pattern_aggregator` — `PatternAggregator` | Empty file |
| `mistakes.mistake_categorizer` — `MistakeCategorizer` | Empty file |
| `mistakes.critical_moments` — `CriticalMoments` | Empty file |
| `mistakes.mistake_frequency` — `MistakeFrequency` | Empty file |
| `openings.opening_repertoire` — `OpeningRepertoire` | Empty file |
| `openings.opening_performance` — `OpeningPerformance` | Empty file |
| `openings.opening_mistakes` — `OpeningMistakes` | Empty file |
| `openings.opening_recommendations` — `OpeningRecommendations` | Empty file |
| `openings.opponent_opening_loss` — `OpponentOpeningLoss` | Empty file |
| `worker_core.study_suggestions` — `StudySuggestions` | **Missing** |
| `worker_core.opening_suggestions` — `OpeningSuggestions` | **Missing** |
| `worker_core.puzzle_generator` — `PuzzleGenerator` | **Missing** |
| `utils.time_utils` — `calculate_time_spent` | Empty file |
| `utils.opening_db` — `OpeningDB` | Empty file |
| `storage.position_cache` — `PositionCache` | Empty file |
| `storage.analysis_storage` — `AnalysisStorage` | **Duplicate** (also in `worker_core/`) |

---

## Dependencies

| Package | Purpose |
|---|---|
| `python-chess` | Chess board, move generation, PGN parsing, UCI engine communication |
| `supabase` | Supabase client (job polling + status updates) |
| `pydantic-settings` | Type-safe configuration from `.env` |
| `fpdf2` | PDF report generation |
| `matplotlib` | Chart visualization for reports |
| `zstandard` | Compression (PGN archives) |
| `tqdm` | Progress bars for batch processing |
| `requests` | HTTP fetching (Chess.com / Lichess APIs) |
| `python-dotenv` | `.env` file loading |
| `fastapi` / `uvicorn` | *(listed but may be for a sibling FastAPI server)* |

---

## Environment Variables (`.env`)

```
SUPABASE_URL=https://psfnisabnhaljtksiutn.supabase.co
SUPABASE_SERVICE_KEY=eyJ... (anon key)
STOCKFISH_PATH=stockfish
```

**Security note**: The current `.env` uses the Supabase **anon** key, not a **service_role** key. For a worker that reads/writes any user's data, a `service_role` key is required to bypass RLS.

---

## Key Files Reference

| File | Lines | Purpose |
|---|---|---|
| `worker.py` | 79 | Entry point, Supabase polling loop |
| `worker_config.py` | 51 | Pydantic Settings, all config values |
| `worker_core/engine_manager.py` | 111 | Stockfish process + evaluation |
| `worker_core/engine_semaphore.py` | 7 | Concurrency semaphore |
| `worker_core/game_analyzer.py` | 334 | Single-game analysis (core logic) |
| `worker_core/batch_analyzer.py` | 269 | Multi-game batch + aggregation |
| `worker_core/move_classifier.py` | 92 | Move quality labeling |
| `worker_core/tactical_validator.py` | 279 | Tactical error detection |
| `worker_core/analysis_storage.py` | 124 | JSON cache with versioning |
| `worker_core/training_plan.py` | 39 | Training plan generator |
| `worker_core/win_rate.py` | 120 | Win rate statistics |
| `utils/position_utils.py` | 40 | Hanging piece detection |
