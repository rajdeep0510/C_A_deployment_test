# Chess Advisor — Product Vision & Feature Roadmap

> **Internal document. For team and academy sales discussions.**
> Last updated: June 2026

---

## The Market Opportunity

No software owns the chess academy market today.

- **Chess.com** — built for casual consumers, not coaches
- **Lichess** — free and open, zero academy management
- **ChessBase** — desktop-only, expensive, no student workflow
- **Chess Tempo** — puzzles only, no personalization, no coach layer

We target the gap: **the software that runs an entire chess academy**. Not a tool coaches open occasionally — the platform they live in daily. Coaches, students, and parents each have a dedicated experience. The data from every game feeds every feature automatically.

**The one-line pitch:**
> *"We turn every game your students play into personalized coaching — automatically. Your coaches focus on teaching, not on reviewing hundreds of games."*

**The business target:**
> 100 academy subscriptions at $199/month = $240k ARR. That's a real, fundable business.

---

## Pricing Tiers

| Tier | Target | Price | Unlock |
|---|---|---|---|
| Student Free | Individual players | Free | Basic analysis, 5 own-game puzzles/week |
| Student Pro | Serious players | $9/month | Full analysis, all puzzles, time coaching |
| Academy | Coaches / schools | $99–299/month | Coach dashboard, parent portal, all students, annotations |
| Enterprise | Federations, large clubs | Custom | White-label, API access, bulk reporting |

---

## Current Capabilities (What We Have Today)

| Feature | Status |
|---|---|
| Fetch games from Chess.com & Lichess | ✅ Done |
| Stockfish move-by-move analysis | ✅ Done |
| Blunder / mistake / inaccuracy classification | ✅ Done |
| Multi-layer disk + memory cache | ✅ Done |
| Incremental batch analysis (only new games re-analyzed) | ✅ Done |
| Concurrency control (asyncio semaphore, max 2 engines, 503 on overflow) | ✅ Done |
| Quick opening stats from PGN headers (no Stockfish) | ✅ Done |
| Progress reports & training plans | ✅ Done (report/training-plan bug fix pending) |
| Single-game board replay | ✅ Done |
| Coach dashboard with player roster | ✅ Done |
| YOLOv8 board detection from images | 🔬 Prototype |
| Puzzle section | 🔲 Not started |
| AI Game Narrator | 🔲 Not started |
| Parent portal | 🔲 Not started |
| Coach annotation system | 🔲 Not started |
| Academy analytics dashboard | 🔲 Not started |
| Time management coaching | 🔲 Not started |
| Tournament preparation module | 🔲 Not started |

---

## THE PUZZLE SECTION — Highest Priority

This is the feature that no competitor can replicate at our level of personalization. Every other platform either uses a generic puzzle database or no puzzles at all. We go further in three distinct ways.

### Why Puzzles Matter for Academies

Coaches assign puzzle homework. Students do puzzles between lessons. Parents want to see their child practicing. The puzzle section is the feature students open every day — it drives the highest engagement and the strongest retention of any chess training tool.

### Three Puzzle Modes

---

#### Mode 1 — Own-Game Puzzle Generator (The Killer Feature)

**What it is:**
We take the exact position from a student's game where they made a mistake — strip all context — and serve it back as a puzzle days or weeks later via spaced repetition.

> *"You saw this position before. You went wrong here. What's the best move?"*

The student is solving a puzzle built from their own history. The emotional connection is fundamentally different from a generic database puzzle. No puzzle platform in the world can replicate this because it requires their game data, their Stockfish analysis, and a spaced repetition scheduler — all of which we already have.

**How it works technically:**
1. Stockfish analysis already identifies every blunder/mistake with `eval_before`, `eval_after`, `best_move`, and `cp_loss`
2. We extract the board position (FEN) at that moment
3. We store it as a puzzle: `{ fen, best_move, theme, difficulty, game_source, move_number }`
4. A scheduler (based on SM-2 spaced repetition algorithm) decides when to show it again
5. The student sees the board, plays a move, gets instant feedback
6. Correct → puzzle interval doubles. Wrong → served again tomorrow.

**Puzzle difficulty:**
- Derived from `cp_loss` — a 400 centipawn blunder produces a harder puzzle than a 50cp inaccuracy
- Calibrated to the student's current rating

**Themes automatically tagged from analysis:**
- Hanging piece — from `error_nature: "Hanging Piece"`
- Missed fork / pin / skewer — from tactical pattern data
- Back-rank weakness — from pattern aggregation
- Time pressure — from `error_nature: "Time Pressure"` (serve the position with a countdown timer)
- Endgame technique — from phase data

**What the student sees:**
```
┌─────────────────────────────────────────────────┐
│  Your game vs. alb_ham — Move 23                │
│  You played Qd4. There was a better move.       │
│                                                  │
│  [ Chessboard ]                                  │
│                                                  │
│  Find the best move for White.                  │
│  ⏱ No time limit             Theme: Fork        │
└─────────────────────────────────────────────────┘
```

After solving:
```
┌─────────────────────────────────────────────────┐
│  ✅ Correct! Nxf7+ wins the exchange.           │
│                                                  │
│  In your original game you played Qd4 instead.  │
│  Stockfish: +3.2 advantage lost after Qd4.      │
│                                                  │
│  [See full game]      [Next puzzle]              │
└─────────────────────────────────────────────────┘
```

---

#### Mode 2 — AI-Recommended Themed Puzzles

**What it is:**
Based on the player's weakness profile from batch analysis, we recommend puzzle themes. The puzzles themselves can be sourced from:
- A curated internal puzzle bank we build and own
- Generated programmatically from common chess motifs
- Eventually: user-contributed positions from coach annotations

We do NOT rely on the Lichess database wholesale. We build and own our puzzle content so it becomes a proprietary asset.

**Recommendation logic (already have the data):**
```
Batch analysis shows:
  hanging_piece: 3 errors
  missed_fork:   2 errors
  king_safety:   1 error

→ Recommend: "Hanging Piece" puzzles (priority 1)
→ Recommend: "Fork" puzzles (priority 2)
→ Recommend: "King Safety" puzzles (priority 3)
```

**Difficulty calibration:**
- Pull player's rating from Chess.com stats
- Serve puzzles rated ±150 around their level
- Adaptive: correct answer → next puzzle slightly harder; wrong → same difficulty

**Puzzle themes we support (Phase 1 launch):**
1. Fork (knight, queen, bishop)
2. Pin (absolute, relative)
3. Skewer
4. Hanging piece / free material
5. Back-rank mate
6. Discovered attack
7. Double check
8. Removing the defender
9. Zwischenzug (in-between move)
10. Endgame: king + pawn vs king

---

#### Mode 3 — Time Pressure Drills

**What it is:**
A unique mode that no other platform offers. We use the clock data we already extract from PGN files to identify that a player blunders under time pressure. We then create a training mode specifically for this:

> Solve this position in under 30 seconds. Go.

The puzzle is served with a visible countdown. The goal is to train fast, accurate pattern recognition — the skill that separates good players from great ones in rapid/blitz games.

**How we identify candidates for this mode:**
- `error_nature: "Time Pressure"` already tagged in our analysis
- Player has < 2 minutes on clock when the mistake happens
- We extract that position and tag it as a "time drill" puzzle

**Progressive difficulty:**
- Start: 60 seconds per puzzle
- As success rate improves: 45s → 30s → 20s → 15s

---

### Puzzle Progress Tracking

Every student's puzzle history is stored:

```json
{
  "puzzle_id": "devang040_game_123_move_15",
  "theme": "fork",
  "source": "own_game",
  "attempts": 3,
  "last_solved": "2026-06-03",
  "next_review": "2026-06-10",
  "interval_days": 7,
  "ease_factor": 2.5
}
```

**What the student sees on their puzzle dashboard:**
- Streak counter (days in a row practiced)
- Accuracy by theme (bar chart)
- Puzzles solved this week
- "Due today" count (spaced repetition queue)

**What the coach sees:**
- Which students completed their puzzle homework
- Which themes each student is struggling with
- Students who haven't practiced in 3+ days (flag for follow-up)

---

### Puzzle API (Planned Endpoints)

| Endpoint | Description |
|---|---|
| `GET /api/puzzles/{username}/queue` | Today's due puzzles (spaced repetition) |
| `GET /api/puzzles/{username}/generate` | Generate new puzzles from latest game analysis |
| `POST /api/puzzles/{username}/{puzzle_id}/attempt` | Record an attempt (correct/wrong) |
| `GET /api/puzzles/{username}/stats` | Accuracy by theme, streak, weekly count |
| `GET /api/puzzles/themed/{theme}?rating=900` | Fetch themed puzzles at a given difficulty |

---

## Other High-End Features

### 1. Academy Analytics Dashboard (Coach View)

The coach opens one screen and instantly sees every student's weakness ranked:

```
Academy Overview — June 2026
────────────────────────────────────────────
Weakness            Students Affected  Severity
Back-rank mate      8 / 12 students    🔴 Critical
Endgame technique   7 / 12 students    🔴 Critical
Time management     5 / 12 students    🟡 Medium
Opening knowledge   3 / 12 students    🟢 Low
────────────────────────────────────────────
💡 Suggested group lesson: Back-rank mate (affects 67% of students)
```

The coach sees instantly what to teach in the next group lesson. Currently coaches figure this out by reviewing games one-by-one. We automate the insight.

---

### 2. Parent Portal with Automated Weekly Reports

Parents are the actual paying customers of academies. A beautiful PDF/email report goes out every Sunday:

- Accuracy trend chart (last 4 weeks)
- "Devang improved his opening accuracy by 12% this month"
- "This week's focus: avoiding hanging pieces"
- Puzzles completed this week: 14 ✅
- Coach's note (coach writes one sentence; we build the report around it)

Parents look forward to this report. If the academy switches software, parents notice and push back. This is the stickiest feature we can build.

---

### 3. AI Game Narrator

Raw Stockfish output is intimidating. Kids ignore centipawn numbers.

After every game, an LLM generates a plain-English story:

> *"You opened confidently with the Italian Game and built a solid position through move 12. The turning point came on move 15 — a knight fork on f7 would have won a piece, but you missed it. From there your opponent gradually took control. The bright spot: your endgame technique was excellent once the queens came off."*

For children, this transforms analysis from a chore into a story about their game. For parents reading weekly reports, it's gold. No chess software does this today.

---

### 4. Coach Annotation System

Coach watches a student's game replay and leaves move-by-move text notes:

> Move 15: *"Always check knight moves first. Nxf7+ here forks the queen and rook."*

Student replays their game and sees the coach's exact words on the exact move. It's an async private lesson built into the platform.

This creates enormous value for online coaches and creates platform lock-in — all annotations live in our system.

---

### 5. Time Management Coaching

We already extract clock data from every PGN. We build a Time Personality Profile:

- *"You use 80% of your time budget in the middlegame and rush endgames."*
- *"You make 60% of your blunders when under 2 minutes on the clock."*
- *"Your average think time per move: 23s. At elite level for your rating, it should be 18s."*

Then we prescribe time-specific exercises and time pressure drills (Mode 3 in the puzzle section).

---

### 6. Tournament Preparation Module

Student enters an upcoming tournament. We:
1. Fetch opponent list
2. Pull their recent games from Chess.com
3. Identify their opening repertoire and recurring mistakes
4. Generate a prep pack: *"Your likely Round 1 opponent plays the King's Indian. They struggle against the Sämisch. Here are 5 key positions to know."*

Coaches currently do this manually for hours. We automate it in seconds.

---

### 7. Rival Matching Within the Academy

Students are ranked within their academy. Each student sees their nearest rival (50–100 rating points ahead):

> *"You are 47 points behind Arjun. He struggles with the Sicilian as Black — that's your chance."*

Healthy competition drives engagement. Students play more games, generate more data, stay on the platform longer.

---

### 8. Opening Repertoire Builder

Based on a student's playing style detected from their games (aggressive, positional, defensive), we suggest and build a complete opening repertoire. We track how well they're learning each line and flag gaps.

---

## Build Order — Phase by Phase

### Phase 1 — The Puzzle Section (Current Priority)
- Own-game puzzle generator (Mode 1) — uses existing analysis data
- Spaced repetition scheduler
- Puzzle board UI (react-chessboard already in the app)
- Basic puzzle stats (streak, accuracy by theme)
- Time pressure drills (Mode 3)

### Phase 2 — Academy Layer
- Coach dashboard: academy-wide weakness overview
- Parent report generator (PDF + weekly email)
- Puzzle homework assignment (coach assigns theme, student completes)

### Phase 3 — AI Features
- AI Game Narrator (LLM integration)
- Themed puzzle bank (owned content, not third-party)
- Coach annotation system

### Phase 4 — Competitive Intelligence
- Tournament preparation module
- Rival matching within academy
- Opening repertoire builder

### Phase 5 — Platform Polish
- Mobile app (React Native)
- Offline puzzle mode
- Video lesson integration

---

## Technical Foundations We Need Before Phase 1

Before building the puzzle section, we need:

1. **Fix report and training-plan endpoints** (WinError 2 bug — dedicated branch)
2. **User persistence layer** — puzzle progress needs a database (Supabase is already in the stack for auth; extend it for puzzle records)
3. **Puzzle data model** — define the JSON schema for puzzle storage
4. **Frontend puzzle page** — `/dashboard/puzzles` route with board + controls

The analysis infrastructure (Stockfish, blunder detection, pattern tagging) is already production-ready. The puzzle section is the next natural layer on top of it.

---

*This document is a living roadmap. Features and phases will shift as we learn from academy feedback.*
