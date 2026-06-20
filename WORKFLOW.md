# CHESS-ADVISOR System Workflow

## Overview

A chess analysis platform with two parallel analysis engines (client-side WASM Stockfish 18 and server-side Python Stockfish), role-based auth (players + staff), academy/coach/player hierarchy with approval workflows, puzzle training, and coach annotations.

---

## 1. Architecture Diagram

```
┌─────────────┐     ┌────────────────────────────┐
│  Browser     │     │  Next.js 16 App Router     │
│  (React 19)  │────>│  apps/web                  │
│              │     │                            │
│  Stockfish   │     │  /api/* routes             │
│  18 WASM     │     │  ┌──────────────────────┐  │
│  (Web Worker)│     │  │  Supabase Client      │  │
│              │     │  └──────┬───────────────┘  │
└──────────────┘     └─────────┼──────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │  Supabase            │
                    │  (Postgres + Auth)   │
                    │                     │
                    │  Tables:            │
                    │  - profiles         │
                    │  - players          │
                    │  - academies        │
                    │  - analysis_jobs    │
                    │  - game_annotations │
                    │  - puzzle_attempts  │
                    │  - training_plans   │
                    └──────────┬──────────┘
                               │
                    ┌──────────┴──────────┐
                    │  Python Worker       │
                    │  apps/stockfish-     │
                    │  worker              │
                    │                     │
                    │  Polls analysis_jobs │
                    │  Runs Stockfish CLI  │
                    │  Deep pattern/tactical│
                    └─────────────────────┘
```

---

## 2. Authentication & User Flows

### Two Auth Paths

**Players** (no password):
1. Enter chess username at `/login`
2. Frontend queries `players` table by `chess_username`
3. If found & `status = 'approved'`: stores session in `localStorage` (`playerSession`), redirects to `/onboarding` (first time) or `/dashboard`
4. If `status = 'pending'`: redirects to `/pending`
5. If not found: redirects to `/register`

**Staff** (Coach / Academy Owner / Admin) — Supabase Auth email/password:
1. Enter email at `/login` (auto-detected by `@`)
2. Supabase `signInWithPassword`
3. Frontend fetches `profiles` table by `user.id`
4. Routes by `role`:
   - `admin` → `/admin/dashboard`
   - `academy_owner` → `/academy/dashboard`
   - `coach` → `/coach/dashboard`
5. Status gating: pending → respective `/pending` page, polls for approval

### Registration
- Three-tab form at `/register`: Player (no password, INSERT into `players`), Coach (Supabase signUp + `profiles`), Academy (Supabase signUp + `profiles` + `academies`)
- **Approval chain**: Admin approves academies → Academy owner approves coaches → Coaches approve players

---

## 3. Game Fetching Pipeline

```
Frontend               Next.js API              External API
──────────────────────────────────────────────────────────────
fetchGames() →  GET /api/games?platform=chess.com&username=X&limit=10
                      │
                      ├── fetchChessComGames():
                      │     archives → monthly → map to Game[]
                      │
                      └── fetchLichessGames():
                            ndjson stream → parse → map to Game[]

return Game[] = { platform, url, pgn, white, black, result, end_time }
```

Games are cached in `localStorage` (`recentGames`) after onboarding fetch.

### GameCard → Analysis Navigation
- `GameCard` links: `/analysis/${game.filename}` (main app)
- Coach dashboard links: `/coach/players/${username}/analysis/${encodeURIComponent(game.filename)}`
- `filename` is the game URL slug/ID (e.g., Chess.com game ID or Lichess game ID)

---

## 4. Analysis Engine — Two Paths

### Path A: Client-side WASM Stockfish 18 (Primary)

```
analyzeGame(username, filename)
  │
  ├── if (typeof window !== 'undefined' && engineConfig.enabled)
  │   └── analyzeLocally(username, filename)
  │       │
  │       ├── fetchPgn(username, filename)
  │       │   ├── Lichess: GET https://lichess.org/game/export/{id}
  │       │   └── Chess.com: GET archives → find game by ID
  │       │
  │       ├── new Chess().loadPgn(pgn)
  │       ├── buildGameMoves() → fens[], uciMoves[]
  │       ├── detectOpening() → match fens against openings dictionary
  │       │
  │       ├── EnginePool.create(enginePath, { multiPv: 3 })
  │       │   └── Creates Web Worker running Stockfish 18 WASM
  │       │
  │       ├── engine.evaluateGame({ fens, uciMoves, depth: 18, multiPv: 3 })
  │       │   └── For each position:
  │       │       └── send UCI: position fen ... → go depth 18
  │       │       └── parse output: bestmove, info depth cp/mate pv multipv
  │       │
  │       ├── getMovesClassification() → quality labels per move
  │       │   (Splendid→Brilliant, Perfect→Best, Best→Best,
  │       │    Excellent→Excellent, Okay→Good, Inaccuracy→Inaccuracy,
  │       │    Mistake→Mistake, Blunder→Blunder, Opening→Book, Forced→Forced)
  │       │
  │       ├── computeAccuracy() → per-player accuracy (weighted + harmonic mean)
  │       ├── computeEstimatedElo() → performance rating from CPL
  │       └── mapToAnalysisSchema() → full_history, move_history, phase_accuracy, etc.
  │
  └── else → fallback to server API
```

### Path B: Server-side Python Stockfish (Fallback / Batch)

```
analyzeGame(username, filename)  [server fallback]
  │
  └── POST /api/analyze → INSERT analysis_jobs (pending)
      └── Return { jobId }
          └── Frontend polls GET /api/analyze?jobId=X

Python Worker (every 5s):
  └── SELECT * FROM analysis_jobs WHERE status = 'pending' LIMIT 1
      └── UPDATE status = 'processing'
          └── GameAnalyzer.process():
              ├── Parse PGN
              ├── Evaluate each position with Stockfish CLI
              │   (config: 500K nodes, 1 thread, 64MB hash)
              ├── MoveClassifier: dual-gate thresholds
              │   (CP loss + win probability drop)
              ├── TacticalValidator: pattern detection
              ├── PatternAggregator: strategic themes
              └── Returns GameAnalysisResult
          └── UPDATE status = 'completed', result = <data>
      └── On failure: UPDATE status = 'failed'
```

---

## 5. Analysis Schema (Frontend Expectations)

```typescript
analysis = {
  game_accuracy: number,           // 0-100, user's accuracy
  phase_accuracy?: {               // per-phase breakdown
    opening: number,
    middlegame: number,
    endgame: number,
  },
  white_player: string,
  black_player: string,
  result: string,                  // "1-0", "0-1", "½-½", "*"
  opening_name: string,
  eco_code: string | null,         // from PGN [ECO "..."]
  performance_rating?: number,     // estimated ELO

  // Opening tab
  opening_moves: string[],         // first ~15 SAN moves
  opening_recommendation?: null,   // WASM: null (Python: coach note)

  // Time & patterns (WASM: null, Python: populated)
  time_analysis?: null,
  patterns?: null,

  // Full game history (every move)
  full_history: Array<{
    san: string,                   // move in algebraic notation
    is_user: boolean,              // whether current user played it
  }>,

  // User-only moves with quality
  move_history: Array<{
    move_number: number,
    turn_label: "white" | "black",
    san: string,
    quality: string,               // Brilliant/Best/Excellent/Good/
                                   // Inaccuracy/Mistake/Blunder/Book/Forced
    cp_loss: number,               // centipawn loss
    phase: string,                 // "opening" | "middlegame" | "endgame"
    best_move: string,             // SAN of best engine move
    error_nature?: string | null,  // WASM: null (Python: tactical description)
    eval: number,                  // CP eval before move
    eval_after: number,            // CP eval after move
    eval_before: number,           // same as eval
  }>,
}
```

### Phase Detection (WASM path)
| Phase | Condition |
|-------|-----------|
| Opening | `moveIndex < 10` or FEN matches opening book |
| Endgame | Non-pawn pieces ≤ 6 (any `/RNBQrnbq/` count) |
| Middlegame | Everything else |

---

## 6. Engine Helper Pipeline (WASM)

```
Stockfish output lines
  │
  ├── parseEvaluationResults()
  │   ├── Extract bestmove
  │   ├── Parse info lines → cp/mate + pv + depth + multiPv
  │   ├── formatUciPv() → castling fix (e1h1→e1g1, etc.)
  │   └── Sort lines by cp/mate
  │
  ├── getMovesClassification()
  │   ├── Opening detection (FEN dictionary match)
  │   ├── Forced move detection (only 1 line returned)
  │   ├── Splendid (Brilliant): best move + sacrifice + not losing
  │   ├── Perfect (Best): changed outcome or only good move
  │   ├── Best: played engine's top line
  │   ├── Basic classification by win% drop:
  │   │   < -20 → Blunder, < -10 → Mistake,
  │   │   < -5  → Inaccuracy, < -2 → Okay, else → Excellent
  │
  ├── computeAccuracy()
  │   ├── Win% difference per move → Lichess accuracy formula
  │   ├── Sliding window weights (std by window of len/10)
  │   └── Per-player: (weighted mean + harmonic mean) / 2
  │
  └── computeEstimatedElo()
      ├── Average centipawn loss per player
      └── 3100 * exp(-0.01 * avgCpl), anchored to actual rating if available
```

---

## 7. API Route Reference

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/games?platform&username&limit` | Fetch games from Chess.com/Lichess |
| GET | `/api/stats/[username]` | Win/loss/draw stats by color |
| POST | `/api/analyze` | Create analysis job (server path) |
| GET | `/api/analyze?jobId=X` | Poll analysis job status/result |
| GET | `/api/annotations?coach_id&player_username&filename` | Get move annotations |
| PUT | `/api/annotations` | Create/update annotation |
| DELETE | `/api/annotations/[id]` | Delete annotation |
| GET | `/api/chess-com/[username]/stats` | Proxy Chess.com public stats |
| DELETE | `/api/auth/account` | Delete own account (cascade) |
| DELETE | `/api/auth/admin/users/[id]` | Admin: delete any user |
| DELETE | `/api/auth/admin/academies/[id]` | Admin: delete academy + cascade |
| DELETE | `/api/auth/academy/coaches/[id]` | Academy: remove coach |

---

## 8. Database Tables

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `profiles` | `id, full_name, email, role (coach/admin/academy_owner), academy_id, status` | Staff accounts |
| `players` | `chess_username, full_name, coach_id, status` | Player accounts (passwordless) |
| `academies` | `name, city, description, owner_id, status` | Chess academies |
| `analysis_jobs` | `job_id, username, filename, pgn, status, result (JSONB)` | Analysis queue |
| `game_annotations` | `id, coach_id, player_username, filename, move_index, note` | Coach notes |
| `puzzle_attempts` | `id, player_username, puzzle_id, solved, time_taken, source` | Puzzle history |
| `training_plans` | `player_username, plan (JSON), generated_at` | Personalized plans |

---

## 9. File Layout

```
apps/web/src/
├── app/
│   ├── (public pages)          landing, login, register, pending, onboarding
│   ├── dashboard               player dashboard
│   ├── analysis/[filename]     game analysis page
│   ├── report                  progress report
│   ├── training-plan           training plan
│   ├── puzzles                 puzzle training (4 modes)
│   ├── coach/                  coach routes (dashboard, players, analysis)
│   ├── academy/                academy routes (dashboard)
│   ├── admin/                  admin panel
│   └── api/                    all API routes
│
├── components/                 Header, CoachHeader, GameCard, Loader,
│                               MistakeCard, PatternGrid, TimeAnalysisCard,
│                               AnnotationPanel, PuzzleTrainer, etc.
│
├── contexts/                   PlayerContext, AuthContext, ThemeProvider, PuzzleContext
│
├── lib/
│   ├── engine/                 NEW — WASM Stockfish 18 engine
│   │   ├── engine-pool.ts      multi-worker UCI engine manager
│   │   ├── worker-loader.ts    Web Worker creation + UCI lifecycle
│   │   ├── wasm-detect.ts      WASM/device detection
│   │   ├── stockfish-loader.ts engine path helpers
│   │   ├── openings.ts         13,606 FEN→opening name entries
│   │   └── helpers/
│   │       ├── math.ts         ceilsNumber, harmonic/weighted mean, std dev
│   │       ├── win-percentage.ts CP→win% (Lichess sigmoid)
│   │       ├── parse-results.ts Stockfish output parser
│   │       ├── move-classification.ts quality labeling
│   │       ├── accuracy.ts     per-player accuracy computation
│   │       └── estimate-elo.ts performance rating from CPL
│   ├── engine-config.ts        env var reader (depth, multiPv, workers, enable)
│   ├── chess/integrations.ts   Chess.com/Lichess API clients
│   └── supabase*.ts            Supabase admin/client helpers
│
├── services/
│   ├── api.ts                  all fetch wrappers (games, analyze, annotations, puzzles)
│   └── local-analysis.ts       NEW — WASM orchestrator (PGN fetch → engine → schema map)
│
├── types/
│   └── engine-types.ts         NEW — enums, interfaces, QUALITY_MAP
│
└── public/engines/stockfish-18/  WASM binaries (9 files, ~117MB)
```

---

## 10. Configuration

### WASM Engine (`.env`)
```
NEXT_PUBLIC_ANALYSIS_ENABLE_WASM=true
NEXT_PUBLIC_ANALYSIS_ENGINE_DEPTH=18
NEXT_PUBLIC_ANALYSIS_MULTIPV=3
NEXT_PUBLIC_ANALYSIS_MAX_WORKERS=4
```

### Python Worker (`worker_config.py`)
```
STOCKFISH_PATH=stockfish
ANALYSIS_NODES=500000
ENGINE_THREADS=1
ENGINE_HASH_MB=64
```

### Database
- Supabase project with PostgreSQL + Auth
- Connection via `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (client) and `SUPABASE_SERVICE_ROLE_KEY` (admin routes)
