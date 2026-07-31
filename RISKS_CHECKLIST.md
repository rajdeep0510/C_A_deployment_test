# Chess Advisor — Risk Remediation Checklist

> Generated: 2026-07-31 (rev 2) · Updated: 2026-08-01 (rev 3)
> Source: Read-only code review of the full monorepo (apps/web, apps/stockfish-worker, apps/docs, configs).
> Purpose: Every confirmed risk found during review, with concrete fix steps. Tick boxes as items are fixed.
>
> REV 2 CHANGES: R2 re-verified against GitHub Releases on the same repo. Added
> Section 2 "Will fixing these break the running app?" — behavior-impact analysis.
>
> REV 3 CHANGES: R1 ✅ FIXED (git prune + .gitignore). R3 ✅ FIXED (rate limiting +
> anti-enumeration + player registration password bug). See per-risk Fix Logs.

---

## 0. Quick Summary

| # | Area | Risk | Severity | Status |
|---|------|------|----------|--------|
| R1 | Git hygiene | venv/ (6,331 files) + __pycache__/ (2,587 .pyc) committed to git | **High** | ✅ FIXED |
| R2 | Git hygiene | 371 MB of puzzle chunks committed to git (repo pack = 519 MB) | **High** | ⏳ Open |
| R3 | Security | No rate limiting on login; account enumeration via distinct errors | **High** | ✅ FIXED |
| R4 | Security | No rate limiting / job quota on analysis API; free-tier abuse | **High** | ⏳ Open |
| R5 | Worker | Broken imports in recommendations/ (3 missing modules) | **Medium** | ⏳ Open |
| R6 | Worker | Broken package exports in reports/__init__.py | **Medium** | ⏳ Open |
| R7 | Worker | reports/cohort_report.py imports RATING_RANGES that doesn't exist | **Medium** | ⏳ Open |
| R8 | Worker | metrics/__init__.py imports PerformanceTrends that doesn't exist | **Low** | ⏳ Open |
| R9 | Worker | Duplicate module copies: worker_core/ vs storage/ + metrics/ | **Medium** | ⏳ Open |
| R10 | Worker | engine_semaphore is dead code — MAX_CONCURRENT_ENGINES never enforced | **Medium** | ⏳ Open |
| R11 | Worker | game_analysis_cache is write-only (no web consumer) | **Low** | ⏳ Open |
| R12 | Docs | working.md is stale (claims modules are "empty"/mock) | **Low** | ⏳ Open |
| R13 | Web | reports/pdf_generator.py shape mismatch with BatchAnalyzer output | **Medium** | ⏳ Open |
| R14 | Quality | Zero tests in worker; 1 test in web | **High** | 🔶 In progress |
| R15 | Web | No rate limit on /api/analyze job creation (CPU burn risk) | **High** | ⏳ Open |

---

## 1. Will fixing these break the running app? (Behavior-impact analysis)

**Short answer: NO — with two kinds of exceptions you must be aware of.**

Verified live runtime paths:
- Web live path: `/api/analyze`, `/api/batch`, `/api/puzzles/{library,rush,queue,generate}`, auth routes, report route — these read Supabase + local `puzzle_data/` chunks.
- Worker live path: `worker.py` imports ONLY `worker_core.game_analyzer`, `worker_core.batch_analyzer`, `storage.analysis_storage`. It does NOT import `reports/` or `recommendations/` anywhere.
- Worker HTTP server only answers `200 ok` (health check) — the PDF endpoint `/api/backend/api/report/[username]/pdf` currently fetches the worker's health server, which returns "ok", so the frontend PDF button ALREADY fails today ("PDF generation failed"). PDF is not a working feature in the current live path.

| Fix | Changes runtime behavior? | Notes |
|-----|--------------------------|-------|
| R1 | NO | Removing `venv/`/`*.pyc` from git index leaves working copies intact. Zero runtime effect. |
| R2 | **DEPENDS** | Files are read at RUNTIME by `chunks.ts` (`path.join(process.cwd(), "puzzle_data")`). Removing them from git breaks fresh clones/deploys UNLESS a build step restores them from the existing GitHub Release. Behavior identical if the same files are present at the same path. |
| R3 | **YES (intended)** | Adds throttling on repeated failures; unifies generic error text. Frontend checks error codes `EMAIL_NOT_VERIFIED`, `PASSWORD_RESET_REQUIRED`, `PASSWORD_SETUP_REQUIRED`, `PENDING_APPROVAL` — these codes MUST be preserved. Only the generic invalid-credentials message changes. |
| R4 / R15 | **YES (intended)** | Rate limits / quotas block abusers. Legit users analyzing their own games must stay under generous limits — set quotas high enough for 50-100 game batches. |
| R5 | NO | `recommendations/` not imported on live path; silently None today. Fixing or deleting is invisible. |
| R6 | NO | `reports/__init__.py` not imported on live path. Invisible. |
| R7 | NO | `cohort_report.py` not imported on live path. Invisible. |
| R8 | NO | `metrics/__init__.py` is triggered when submodules import, but the failing `PerformanceTrends` import is caught by try/except; fixing removes a logged error, no visible change. |
| R9 | NO | Live code imports `storage.*` / `metrics.*`; worker_core duplicates are orphans. Delete only after grep-confirming zero imports. |
| R10 | NO (practically) | Worker processes jobs sequentially in one loop, so MAX_CONCURRENT_ENGINES is effectively 1 today. Wiring the semaphore changes nothing observable; deleting it changes nothing. |
| R11 | NO | No web consumer reads `game_analysis_cache`. Dropping writes is invisible. |
| R12 | NO | Docs only. |
| R13 | NO | PDF generator is NOT wired to a live route. Fixing the shape only helps a future feature; current behavior (button fails) is unchanged. |
| R14 | NO | Tests are additive; no runtime effect. |

**Conclusion:** Every fix is behavior-preserving for the current working app, EXCEPT R3/R4/R15 which intentionally harden security (that is the point), and R2 which must be implemented carefully to keep puzzle data available at runtime.

---

## R1. Git hygiene — venv/ and __pycache__/ are committed

**Evidence:**
- `git ls-files apps/stockfish-worker/venv` → **6,331 files** (e.g. `venv/bin/Activate.ps1`)
- `git ls-files apps/stockfish-worker` filtered to `*.pyc` → **2,587 files** (e.g. `apps/stockfish-worker/__pycache__/worker.cpython-311.pyc`)
- `git status -s` shows modified tracked `.pyc` files (M apps/stockfish-worker/__pycache__/worker_config.cpython-311.pyc etc.)
- `.gitignore` only adds `.gstack/` on top of the current ignore set — clearly not enough.

**How to solve:**
- [x] `git rm -r --cached apps/stockfish-worker/venv`
- [x] `git rm -r --cached -- '*.pyc'` (remove all tracked `.pyc`)
- [x] Ensure `.gitignore` includes: `venv/`, `__pycache__/`, `*.py[cod]`, `.env`
- [ ] Add a pre-commit hook or CI check that fails if `venv/` or `*.pyc` appear in `git ls-files`
- [x] Commit the prune in one "repo hygiene" commit
- [x] Verify with: `git ls-files | findstr /i "venv pyc"` → empty

**Fix Log (2026-08-01):**
- Ran `git rm -r --cached apps/stockfish-worker/venv` (removed 6,331 files) and `git rm -r --cached -- '*.pyc'` (removed 2,587 files).
- Added to `.gitignore`: `venv/`, `.venv/`, `__pycache__/`, `*.py[cod]`, `.pytest_cache/`.
- Verified: `git ls-files` has **0** `.pyc` and **0** `venv/` entries; `git check-ignore` confirms the paths are ignored.
- Runtime files remain on disk (worker unaffected). Ready to commit as one repo-hygiene commit.

**Behavior impact:** NONE — the files stay on disk locally; only git's index is pruned.

**Why it matters:** 500+ MB repo slows clones/CI, exposes environment-specific bytecode, and wastes GitHub storage.

---

## R2. Git hygiene — 371 MB of puzzle chunks committed (REVISED after verification)

### What we verified

1. **A GitHub Release DOES exist on this repo**: tag `v1-puzzle_data` on `ranadevarshrajsinh/CHESS-ADVISOR`, containing ~561 categorized CSVs (`endgame_bishop.csv`, `endgame_rook_beginner.csv`, `mate_back_rank_beginner_1.csv`, ...) matching the `resolver.ts` naming convention.
2. **BUT the running app does NOT fetch from GitHub Releases.** `lib/puzzles/resolver.ts` (which builds release download URLs from `PUZZLE_RELEASE_BASE_URL`) is imported NOWHERE — zero consumers. `PUZZLE_RELEASE_BASE_URL` is listed in `turbo.json` env but is NOT set in `apps/web/.env`.
3. **The live puzzle routes read LOCAL committed files:**
   - `/api/puzzles/library` → `loadRandomPuzzles` from `@/lib/puzzles/chunks` → reads `apps/web/puzzle_data/*.csv.gz` on disk
   - `/api/puzzles/rush` → `loadLadderPuzzles` from same
   - `/api/puzzles/[username]/queue` and `/generate` → read Supabase tables (`puzzles` table), not files
4. The 55 gzipped chunk files (371 MB) ARE committed in git (added in `fff8644` / `0cbc956`).

**So:** The "GitHub Releases" architecture from `PUZZLE_INTEGRATION_PLAN.md` is the *planned/partial* design (only `resolver.ts` exists, unwired). The *actual* implementation serves the committed local chunks.

### How to solve (behavior-preserving — do NOT change the serving code)

- [ ] Keep `chunks.ts` reading `puzzle_data/` at runtime (no code change to serving path)
- [ ] Option A (recommended): `git rm -r --cached apps/web/puzzle_data` + add `apps/web/puzzle_data/*.csv.gz` to `.gitignore`, then add a build/deploy step that downloads the chunks into `apps/web/puzzle_data/` from the existing `v1-puzzle_data` release (or re-upload the same chunk files as a new release asset)
- [ ] Option B: keep files in git but switch to Git LFS for the repo (no code change, smaller clone)
- [ ] Option C: fully wire the planned path — implement the fetch-cache route from `PUZZLE_INTEGRATION_PLAN.md` and set `PUZZLE_RELEASE_BASE_URL` in `.env` + Vercel (this IS a code change; only do if you want the release-based architecture)
- [ ] If Option A: ensure the download step runs BEFORE `next build` on Vercel and on dev machines (document it)
- [ ] Verify: fresh clone + `npm run build` + call `/api/puzzles/library?ratingMin=1000&ratingMax=1400&limit=1` → returns a puzzle (same as today)

**Behavior impact:** Identical IF the same chunk files exist at the same path at runtime. If the files are missing (no build step), the puzzle library and rush features return empty arrays. The GitHub release already exists, so Option A has a reliable source.

**Why it matters:** 371 MB payloads bloat the deploy bundle, can exceed Vercel build/upload limits over time, and make every clone slow.

---

## R3. Security — no login rate limit + account enumeration

**Evidence:** `apps/web/src/app/api/auth/login/route.ts` has **no** rate limiting. Only `resend-verification` and `forgot-password` have in-memory rate-limit maps. Login/register error messages distinguish "invalid credentials" vs "email already registered" vs "account doesn't exist" → allows email/username enumeration.

**How to solve:**
- [x] Add an in-memory or Redis-backed rate limiter to `login`, `register`, `reset-password` (e.g. 5 attempts / 15 min per IP+email)
- [x] Return identical generic error text for "bad password" vs "no such user" (login already did this; signup now returns a generic 201 for taken email/username)
- [x] **DO NOT change** the machine-readable codes the frontend relies on: `EMAIL_NOT_VERIFIED`, `PASSWORD_RESET_REQUIRED`, `PASSWORD_SETUP_REQUIRED`, `PENDING_APPROVAL` (checked in `login/page.tsx`)
- [x] On the register route, return the same message whether the email exists or not (or always send a verification email to avoid enumeration)
- [x] Add a test asserting identical responses for existing vs non-existing email

**Fix Log (2026-08-01):**
- Added shared in-memory limiter `apps/web/src/lib/rate-limit.ts` (`isRateLimited(key, limit, windowMs)` + `getClientIp(request)`), consistent with the existing forgot-password/resend-verification pattern.
- `login/route.ts`: per-IP limit (20 / 15 min) + per-identifier limit (5 / 15 min) checked **before** any DB work or bcrypt cost; returns 429 on exceed. Existing generic error text and all machine codes preserved.
- `signup/route.ts`: per-IP (5 / 15 min) + per-email (3 / 15 min) limits; `EMAIL_TAKEN` / `USERNAME_TAKEN` now return the same generic 201 as a fresh registration (no more 409 "already registered" — stops enumeration).
- `reset-password/route.ts`: per-IP limit (10 / 15 min).
- **Bonus bug fix (user-reported):** player registration form has no password field, but the route rejected every player signup with "Password must be at least 8 characters". Player registrations now skip the password requirement; `registerPlayerUser` stores a `*pending-setup` placeholder hash so the existing `PASSWORD_SETUP_REQUIRED` → `/set-password` flow works on first login. Staff (`coach`/`academy_owner`) still require a password.
- Tests added: `apps/web/src/__tests__/rate-limit.test.ts` (window/per-key/limit logic) and `apps/web/src/__tests__/signup-enumeration.test.ts` (generic 201 for taken email/username; player no-password path). Full web suite: 31 tests passing.

**Behavior impact:** Intended hardening. Legit users see the same happy-path login. Only repeated-failure and error-message behavior changes.

**Why it matters:** Password spraying and account enumeration enable targeted attacks; both are OWASP-relevant (A07, A01).

---

## R4. Security — no rate limit / quota on analysis job creation

**Evidence:** `apps/web/src/app/api/analyze/[username]/route.ts` accepts any username and creates a job for any anonymous caller; the poll/status routes accept arbitrary job IDs.

**How to solve:**
- [ ] Require auth (or a lightweight session token) for `/api/analyze/*`
- [ ] Add per-user / per-IP job quota (e.g. max 3 in-flight jobs, max 50/day, with batch of up to 100 games allowed)
- [ ] Use Vercel Edge rate limiting or a Supabase counter table
- [ ] Cap batch size server-side regardless of client input
- [ ] Reject job creation for usernames that fail a cheap existence check first
- [ ] Add auth checks on report/stats routes that reveal user PGNs

**Behavior impact:** Intended hardening. Set quotas high enough that legitimate large batch analyses still succeed.

**Why it matters:** Unauthenticated job creation lets anyone burn worker CPU against Stockfish (free-tier cost + DoS on other users' analysis).

---

## R5. Worker — recommendations/ imports three non-existent modules

**Evidence:** `apps/stockfish-worker/recommendations/training_plan.py` and `worker_core/training_plan.py` import `study_suggestions`, `opening_suggestions`, `puzzle_generator`. Grep shows **none** of these modules exist anywhere. `recommendations/__init__.py` wraps the imports in `try/except ImportError` and silently sets `TrainingPlan = None`, `PuzzleGenerator = None`, etc.

**How to solve:**
- [ ] Decide: implement the three modules (feature work) **or** delete the `recommendations/` package + `worker_core/training_plan.py` if unused
- [ ] Remove the silent `except ImportError: ... = None` pattern — replace with explicit lazy imports or remove
- [ ] Add `python -c "import recommendations"` to a smoke test
- [ ] If kept, import from the actual module locations

**Behavior impact:** NONE — not on the live worker path (worker.py never imports it).

**Why it matters:** Silent `None` exports hide breakage; any future import of `recommendations` yields unusable objects and cryptic downstream errors.

---

## R6. Worker — reports/__init__.py broken package exports

**Evidence:** `apps/stockfish-worker/reports/__init__.py` does:
```python
from worker_core.student_report import StudentReport
from worker_core.progress_report import ProgressReport
from worker_core.cohort_report import CohortReport
from worker_core.pdf_generator import PdfGenerator
```
None of these exist in `worker_core/`. The real modules live in `reports/` itself. Wrapped in `try/except` → all exports silently `None`.

**How to solve:**
- [ ] Rewrite `reports/__init__.py` to import from its own package:
```python
from reports.student_report import StudentReport
from reports.progress_report import ProgressReport
from reports.cohort_report import CohortReport
from reports.pdf_generator import PdfGenerator
```
- [ ] Add `python -c "from reports import *"` smoke test
- [ ] Remove any file referencing `worker_core.student_report` etc.

**Behavior impact:** NONE — not on the live worker path.

**Why it matters:** Same silent-None trap; anyone importing `reports` gets `None` objects instead of the real classes.

---

## R7. Worker — cohort_report.py imports missing RATING_RANGES

**Evidence:** `apps/stockfish-worker/reports/cohort_report.py` line 2: `from config.thresholds import RATING_RANGES`. `config/thresholds.py` only defines `ANALYSIS_THRESHOLDS` — no `RATING_RANGES`.

**How to solve:**
- [ ] Add `RATING_RANGES` (e.g. chess.com-style bands: 0-799, 800-999, 1000-1199, ...) to `config/thresholds.py`
- [ ] Or define it locally in `cohort_report.py`
- [ ] Verify `python -c "from reports.cohort_report import CohortReport"` succeeds

**Behavior impact:** NONE — not on the live worker path.

**Why it matters:** `ImportError` on first use; cohort report feature is broken even if `reports/__init__.py` is fixed.

---

## R8. Worker — metrics/__init__.py imports non-existent PerformanceTrends

**Evidence:** `apps/stockfish-worker/metrics/__init__.py` line 10: `from metrics.performance_trends import PerformanceTrendAnalyzer, PerformanceTrends`. `performance_trends.py` defines only `PerformanceTrendAnalyzer`. Also `metrics/__init__.py` imports `metrics.win_rate` (WinRateAnalyzer) which exists but is unused in the live path.

**How to solve:**
- [ ] Remove the bogus `PerformanceTrends` import (or add the class if it is meant to exist)
- [ ] Remove unused `WinRateAnalyzer` import or wire it into `BatchAnalyzer` if needed
- [ ] Add `python -c "import metrics"` smoke test

**Behavior impact:** NONE — the failing import is already caught by try/except today; live analysis still runs.

**Why it matters:** Package import fails whenever `metrics` is imported as a package (silent None via try/except).

---

## R9. Worker — duplicate module copies

**Evidence:** Three byte-identical duplicates:
- `worker_core/analysis_storage.py` ↔ `storage/analysis_storage.py`
- `worker_core/cache_manager.py` ↔ `storage/cache_manager.py`
- `worker_core/win_rate.py` ↔ `metrics/win_rate.py`

Grep shows live code imports the `storage.*` / `metrics.*` versions. `worker_core/` copies are orphans.

**How to solve:**
- [ ] Before deleting, confirm zero imports: search for `worker_core.analysis_storage`, `worker_core.cache_manager`, `worker_core.win_rate` in apps/stockfish-worker → must be empty
- [ ] Delete the three orphan files in `worker_core/`
- [ ] Add a lint rule / CI check that fails if a module is duplicated
- [ ] Re-run worker smoke test (worker starts and processes a job)

**Behavior impact:** NONE — live code already imports the canonical copies.

**Why it matters:** Duplicate code drifts; a fix applied to one copy silently misses the other.

---

## R10. Worker — engine_semaphore is dead code

**Evidence:** `apps/stockfish-worker/worker_core/engine_semaphore.py` defines `engine_semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_ENGINES)` with a docstring claiming it is "Acquired in router._run_with_engine()" — but there is **no router** in this codebase, and a search for `engine_semaphore` shows only its definition. It is never acquired → `MAX_CONCURRENT_ENGINES` is never enforced.

**How to solve:**
- [ ] Option 1 (wire it up): acquire the semaphore in `worker.py`'s job handler (or `GameAnalyzer`) around Stockfish analysis:
```python
async with engine_semaphore:
    result = await game_analyzer.analyze_game(...)
```
- [ ] Option 2 (delete): remove `engine_semaphore.py` and document that the single worker loop serializes engine use
- [ ] Add a test asserting max concurrent engine processes ≤ `MAX_CONCURRENT_ENGINES`

**Behavior impact:** Practically NONE — the worker currently processes jobs sequentially in one polling loop, so concurrency is already 1. Wiring the semaphore won't change observable throughput today.

**Why it matters:** Configuration intent (limit concurrent engines) is silently ignored — can oversubscribe memory/CPU if concurrency is ever added.

---

## R11. Worker — game_analysis_cache is write-only

**Evidence:** Worker writes `game_analysis_cache` rows; `batch_analyzer.py` writes with `ON CONFLICT DO NOTHING`. No file in `apps/web/src` references `game_analysis_cache`. The web app reads `analysis_jobs`/`batch_jobs` result columns instead.

**How to solve:**
- [ ] Decide intent: (a) use the cache as a read source in report/stats routes to save re-analysis, or (b) drop the table and the write code
- [ ] If kept: add a read path and a cache-busting version field
- [ ] If dropped: remove writes in `worker.py`/`batch_analyzer.py`, drop the table via migration

**Behavior impact:** NONE — no web consumer reads it today.

**Why it matters:** Dead writes waste Supabase storage and can confuse future devs into trusting stale data.

---

## R12. Docs — working.md is stale

**Evidence:** `apps/stockfish-worker/working.md` describes many modules as "empty"/"placeholder"/"missing" (e.g. storage, metrics, batch_analyzer, puzzle_solver) — but they are all fully implemented. It also documents a "mock" worker that no longer matches the real `worker.py`.

**How to solve:**
- [ ] Regenerate the doc from the actual code (or delete it and rely on ARCHITECTURE_WORKER.md if accurate)
- [ ] Add a "last verified on <date>" line to any architecture docs
- [ ] Update docs in the same PR as code changes

**Behavior impact:** NONE — docs only.

**Why it matters:** Misleading docs cause wrong assumptions about capabilities (e.g. "puzzle solver is empty").

---

## R13. Web — PDF generator shape mismatch

**Evidence:** `apps/stockfish-worker/reports/pdf_generator.py` expects:
- `openings_perf[eco]["combined"]["total_games"]`
- `trends.averages.peak_rating`, `trends.current_momentum`, `trends.max_win_streak`
- `patterns.time_pressure.total_time_pressure_errors`
- `openings.repertoire.top_openings.user_white`

But `BatchAnalyzer._aggregate_results` produces:
- `openings.performance.by_opening[]` (a list, not a dict keyed by eco with `combined`)
- `trends` with keys `trend`, `momentum`, `average_accuracy`, `recent_accuracy`, `older_accuracy`
- `patterns.time_pressure.time_pressure_summary.time_pressure_errors`
- `openings.most_played`

So `report_to_pdf` will produce empty sections or crash if ever called. Also, the worker's HTTP server only answers health checks — the `/api/backend/api/report/[username]/pdf` web route proxies to the worker and receives "ok", so the Download PDF button already fails today.

**How to solve:**
- [ ] Add a schema/type module shared between `BatchAnalyzer` and `pdf_generator`
- [ ] Make `pdf_generator` consume the real `_aggregate_results` shape (or write a mapper)
- [ ] If PDF is meant to work: implement the PDF route in the worker (currently missing) so `/api/backend/api/report/[username]/pdf` returns a real PDF
- [ ] Add a unit test that runs `report_to_pdf(batch_analyzer_results_fixture)` and asserts no exceptions + non-empty PDF
- [ ] If PDF is not used anywhere, mark it `@deprecated` or remove

**Behavior impact:** NONE on current behavior — the PDF button already fails today. This fix only enables a currently-broken feature.

**Why it matters:** Latent feature that will misreport (or crash) the moment it is enabled.

---

## R14. Quality — zero tests in worker, near-zero in web

**Evidence:** Only test file found: `apps/web/puzzle-filter.test.ts` (a single filter test). The worker has no `test_*.py` / `*.test.py` files.

**How to solve:**
- [ ] Add pytest: seed `GameAnalyzer` with a known PGN and assert move classification / accuracy thresholds
- [ ] Add tests for `move_classifier`, `tactical_validator`, `win_rate` formula vs known engine eval
- [ ] Add contract test: `BatchAnalyzer` output shape == what `pdf_generator` / report routes expect
- [ ] Add a smoke test that imports every worker package (worker_core, storage, metrics, reports, recommendations)
- [ ] Add Vitest tests for the analyze/report routes with a mocked Supabase client

**Behavior impact:** NONE — tests are additive.

**Why it matters:** This is the core product logic (move accuracy, win rate, training plan). No tests = silent regressions on every refactor.

---

## R15. Web — no rate limit on /api/analyze (CPU burn / cost risk)

**Evidence:** `apps/web/src/app/api/analyze/[username]/route.ts` has no limiter; any anonymous caller can create analysis jobs.

**How to solve:**
- [ ] Add per-IP + per-user limits (e.g. Vercel Edge rate limiting or a Supabase counter)
- [ ] Add a daily quota table + decrement on job creation
- [ ] Require auth (or a lightweight anonymous token) for the analyze endpoints
- [ ] Add a max jobs-per-user guard in the batch status route too

**Behavior impact:** Intended hardening. Set quotas generous enough for legitimate batch analysis (50-100 games per run).

**Why it matters:** Free-tier worker burn; one attacker can queue hundreds of Stockfish analyses and exhaust the Supabase/Vercel free tier.

---

## Notes for implementation

- Progress: **R1 ✅ and R3 ✅ done** (2026-08-01, see Fix Logs above). Remaining recommended order: **R2** (repo hygiene, do next — 371 MB chunks), then **R4/R15** (analysis API security), **R5–R10** (worker correctness), **R13** (contract), **R14** (tests, after contracts are defined), **R12** (docs last).
- R1/R3 changes are staged but **not yet committed**; commit R1 (repo hygiene) and R3 (auth hardening) as two separate commits.
- All worker smoke tests can be one file: `apps/stockfish-worker/tests/test_imports.py`.
- Keep the shared output shape change (R13) in a single PR so the report routes and PDF generator move together.
- For R2, do NOT change `chunks.ts` serving logic — only change where the files come from at deploy time.
