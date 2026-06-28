# Bug Report

## Metadata

- **Report Date:** 2026-06-23
- **Bug Title:** Every "Analyze Game" button analyzes the same (most recent) game due to missing `filename` field
- **Severity:** Critical
- **Status:** Implemented
- **Confidence:** High

---

## User Report

When a player is logged in and goes to the dashboard where all games are available, clicking on any analysis button results in analysis of the same game every time. Users "Devarsh10" and "vicky1111111" reported this issue. The problem might be that the PGN file is not being fetched correctly from Chess.com.

---

## Reproduction Steps

1. Log in as any Chess.com user (e.g., "Devarsh10" or "vicky1111111").
2. Navigate to the Onboarding page and click "Fetch Games" to load recent games.
3. You are redirected to the Dashboard where multiple GameCards are displayed.
4. Click the "Analyze Game" button on **any** game card (not the most recent one).
5. Observe that the analysis page always analyzes the **same** game — the most recent one from Chess.com archives.
6. Click "Back" and try a different game card. The same game is analyzed again.

---

## Expected Behavior

Each "Analyze Game" button should link to the specific game displayed on that card, and the analysis page should analyze that exact game's PGN.

---

## Actual Behavior

- All "Analyze Game" buttons link to `/analysis/undefined` because `game.filename` is `undefined`.
- The analysis page detects the `"undefined"` string and falls back to `fetchFallbackPgn()`, which always returns the **most recent** game from Chess.com archives.
- The same game (the most recent one) is analyzed every time, regardless of which card the user clicks.

---

## Root Cause Analysis

### The Bug Chain (4-part failure)

#### Part 1 — Missing `filename` in game data fetch

**File:** `apps/web/src/lib/chess/integrations.ts`  
**Function:** `fetchChessComGames()` (lines 24-32)

```typescript
return allGames.slice(0, limit).map((game: any) => ({
  platform: "chess.com",
  url: game.url,
  pgn: game.pgn,
  white: game.white.username,
  black: game.black.username,
  result: game.white.result,
  end_time: game.end_time,
  // ❌ filename is NEVER set here
}));
```

The `filename` property is absent from the mapped return object. The `Game` interface defines `filename?: string` as optional (line 26 in `packages/types/src/index.ts`), so TypeScript does not flag this omission.

The same issue exists for `fetchLichessGames()` (lines 55-63):

```typescript
const stdGame: Game = {
  platform: "lichess",
  url: `https://lichess.org/${game.id}`,
  pgn: game.pgn,
  white: game.players.white.user.name,
  black: game.players.black.user.name,
  result: game.winner,
  end_time: game.createdAt,
  // ❌ filename is NEVER set here either
};
```

#### Part 2 — GameCard uses `filename` unconditionally

**File:** `apps/web/src/components/GameCard.tsx`  
**Line:** 53-54

```tsx
<Link
  href={`/analysis/${game.filename}`}
  className="btn btn-primary btn-sm"
>
  Analyze Game
</Link>
```

Since `game.filename` is `undefined`, the rendered link becomes:  
`<a href="/analysis/undefined">Analyze Game</a>`

Every single game card gets the **same** href: `/analysis/undefined`.

**Contrast with coach views** (which handle this correctly):
- `apps/web/src/app/coach/(app)/dashboard/page.tsx` (line 1295): `{game.filename && ( <a href=...> )}` — hides button when `filename` is missing.
- `apps/web/src/app/coach/(app)/players/[username]/page.tsx` (line 2357): `{game.filename && ( <a href=...> )}` — same safe pattern.

#### Part 3 — Analysis page passes `"undefined"` string to PGN fetcher

**File:** `apps/web/src/app/analysis/[filename]/page.tsx`  
**Lines:** 131-138, 214

```tsx
params: Promise<{ filename: string }>;
// ...
const { filename } = resolvedParams;  // filename = "undefined" (the string)
// ...
analyzeGame(chessUsername, filename)  // analyzeGame(chessUsername, "undefined")
```

The route parameter `[filename]` captures the literal string `"undefined"` from the URL `/analysis/undefined`.

#### Part 4 — `fetchPgn` explicitly rejects `"undefined"` and falls back to most recent game

**File:** `apps/web/src/services/local-analysis.ts`  
**Function:** `fetchPgn()` (lines 74-106)

```typescript
async function fetchPgn(username: string, filename: string): Promise<string> {
  const decoded = decodeURIComponent(filename);  // "undefined" → "undefined"

  if (decoded && decoded !== "undefined" && decoded !== "null") {
    // ❌ This block is SKIPPED because decoded IS "undefined"
    // ... try lichess regex ...
    // ... try chess.com regex ...
  }

  // ⬇️ Falls through here every time
  const pgn = await fetchFallbackPgn(username);  // Always returns most recent game
  if (pgn) return pgn;
  // ...
}
```

**File:** `apps/web/src/services/local-analysis.ts`  
**Function:** `fetchFallbackPgn()` (lines 108-142)

```typescript
async function fetchFallbackPgn(username: string): Promise<string | null> {
  for (const platform of ["chess.com", "lichess"] as const) {
    // ...
    if (platform === "chess.com") {
      const { archives } = await res.json();
      // ...
      const { games } = await archiveRes.json();
      if (games?.[0]?.pgn) return games[0].pgn;  // ⬅️ ALWAYS returns the very first (most recent) game
    }
  }
}
```

`games[0]` is the **first/most recent game** in the latest monthly archive. This is the same game every time.

### Summary of the Logic Chain

```
fetchChessComGames() omits "filename" property
        ↓
GameCard renders /analysis/undefined for every game
        ↓
Analysis page receives filename = "undefined" (string)
        ↓
fetchPgn() skips regex parsing (explicit "undefined" guard)
        ↓
fetchFallbackPgn() returns games[0].pgn (most recent game)
        ↓
SAME GAME analyzed every time
```

---

## Evidence

### 1. Missing `filename` in `fetchChessComGames`

**File:** `apps/web/src/lib/chess/integrations.ts` lines 24-32

```typescript
return allGames.slice(0, limit).map((game: any) => ({
  platform: "chess.com",
  url: game.url,
  pgn: game.pgn,
  white: game.white.username,
  black: game.black.username,
  result: game.white.result,
  end_time: game.end_time,
  // filename is MISSING — this is the root cause
}));
```

### 2. Missing `filename` in `fetchLichessGames`

**File:** `apps/web/src/lib/chess/integrations.ts` lines 55-63

```typescript
const stdGame: Game = {
  platform: "lichess",
  url: `https://lichess.org/${game.id}`,
  pgn: game.pgn,
  white: game.players.white.user.name,
  black: game.players.black.user.name,
  result: game.winner,
  end_time: game.createdAt,
  // filename is MISSING here too
};
```

### 3. GameCard unconditional usage of `game.filename`

**File:** `apps/web/src/components/GameCard.tsx` lines 53-58

```tsx
<Link
  href={`/analysis/${game.filename}`}
  className="btn btn-primary btn-sm"
>
  Analyze Game
</Link>
```

### 4. `fetchPgn` explicit rejection of `"undefined"` string

**File:** `apps/web/src/services/local-analysis.ts` lines 74-106

```typescript
async function fetchPgn(username: string, filename: string): Promise<string> {
  const decoded = decodeURIComponent(filename);

  if (decoded && decoded !== "undefined" && decoded !== "null") {
    // ... lichess and chess.com regex matching ...
    // NEVER REACHED because decoded === "undefined"
  }

  const pgn = await fetchFallbackPgn(username);
  // ALWAYS returns most recent game
}
```

### 5. `fetchFallbackPgn` always returns `games[0]`

**File:** `apps/web/src/services/local-analysis.ts` lines 108-142

```typescript
if (games?.[0]?.pgn) return games[0].pgn;
// ^--- Always the first (most recent) game
```

### 6. Type definition shows `filename` as optional

**File:** `packages/types/src/index.ts` lines 18-27

```typescript
export interface Game {
  platform: 'chess.com' | 'lichess';
  url: string;
  pgn: string;
  white: string;
  black: string;
  result: string;
  end_time: number;
  filename?: string;  // Optional — hides the bug
}
```

---

## Impact Assessment

| Category | Impact |
|----------|--------|
| **Affected Users** | ALL logged-in players using the dashboard. Also affects coaches viewing student games. |
| **Functionality** | Single-game analysis is completely broken. The "Analyze Game" button on every card always analyzes the same (most recent) game instead of the intended game. |
| **Production Impact** | **Critical.** The core feature of the application (analyzing specific games from a list) is non-functional. Users cannot analyze games they select. |
| **Security Impact** | None. |
| **Performance Impact** | Minimal — unnecessary PGN fetches for the fallback path, but the user already experienced a full analysis anyway. |
| **Coach Experience** | Coach views (lines 1295, 2357) conditionally hide the Analyze button when `filename` is missing, so coaches would simply see no "Analyze" button for any student game. This is also broken — games cannot be analyzed through the coach dashboard. |

---

## Possible Solutions

### Solution A (Recommended) — Add `filename` field in both fetch functions

**Description:** Add `filename: game.url` to the return objects in both `fetchChessComGames` and `fetchLichessGames` in `apps/web/src/lib/chess/integrations.ts`.

**Pros:**
- Fixes the root cause at the data source.
- All consumers (GameCard, coach dashboards) will automatically get correct links.
- The `filename` value matches the regex patterns in `fetchPgn`:
  - Chess.com URL `https://www.chess.com/game/live/1234567890` → regex extracts `1234567890`
  - Lichess URL `https://lichess.org/abcdef12` → regex extracts `abcdef12`
- Minimal change — 2 lines added.
- No TypeScript changes needed.

**Cons:**
- None.

**Implementation:**

In `fetchChessComGames` (line 24-32), add `filename: game.url`:

```typescript
return allGames.slice(0, limit).map((game: any) => ({
  platform: "chess.com",
  url: game.url,
  pgn: game.pgn,
  white: game.white.username,
  black: game.black.username,
  result: game.white.result,
  end_time: game.end_time,
  filename: game.url,   // ← ADD THIS
}));
```

In `fetchLichessGames` (line 55-63), add `filename: stdGame.url`:

```typescript
const stdGame: Game = {
  platform: "lichess",
  url: `https://lichess.org/${game.id}`,
  pgn: game.pgn,
  white: game.players.white.user.name,
  black: game.players.black.user.name,
  result: game.winner,
  end_time: game.createdAt,
  filename: `https://lichess.org/${game.id}`,  // ← ADD THIS
};
```

### Solution B — Add defensive check in GameCard

**Description:** Add a conditional guard in `GameCard.tsx` similar to the coach views, so the link is only rendered when `game.filename` exists.

**Pros:**
- Prevents broken `/analysis/undefined` links.

**Cons:**
- Does not fix the root cause — the link would simply disappear.
- Users would not be able to analyze any game.
- Coach views already have this guard and still can't analyze games.

### Solution C — Add defensive check in `fetchPgn`

**Description:** Remove the `"undefined"` and `"null"` string checks from `fetchPgn` in `local-analysis.ts`, so it attempts to parse the filename as a regex even when it's `"undefined"`.

**Pros:**
- Would prevent the fallback behavior.

**Cons:**
- The regex would not match `"undefined"`, so it would still fall through to `fetchFallbackPgn`.
- Does not fix the root cause — the wrong filename is still being passed.
- Would break legitimate cases where a game URL genuinely contains `"undefined"` or `"null"` (extremely unlikely but possible).

---

## Files Involved

1. **`apps/web/src/lib/chess/integrations.ts`** — Root cause: `fetchChessComGames()` and `fetchLichessGames()` do not set the `filename` field.
2. **`apps/web/src/components/GameCard.tsx`** — Uses `game.filename` unconditionally, creating broken links.
3. **`apps/web/src/services/local-analysis.ts`** — `fetchPgn()` has an explicit guard against the `"undefined"` string, causing fallback to most recent game; `fetchFallbackPgn()` always returns `games[0]`.
4. **`apps/web/src/app/analysis/[filename]/page.tsx`** — Consumes the `"undefined"` filename from the URL and passes it to `analyzeGame()`.
5. **`packages/types/src/index.ts`** — `Game.filename` is optional, allowing the bug to compile without errors.
6. **`apps/web/src/app/coach/(app)/dashboard/page.tsx`** — Conditionally handles missing `filename` (line 1295), but still affected by root cause.
7. **`apps/web/src/app/coach/(app)/players/[username]/page.tsx`** — Conditionally handles missing `filename` (line 2357), but still affected.

---

## Recommended Fix Order

1. **Immediate fix:** Add `filename: game.url` to `fetchChessComGames()` and `fetchLichessGames()` in `integrations.ts`.
2. **Related hardening:** Add a defensive check in `GameCard.tsx` to conditionally render the link:
   ```tsx
   {game.filename && (
     <Link href={`/analysis/${game.filename}`} className="btn btn-primary btn-sm">
       Analyze Game
     </Link>
   )}
   ```
3. **Preventative improvement:** Change `Game.filename` from optional (`filename?: string`) to required (`filename: string`) in `packages/types/src/index.ts`, so the TypeScript compiler catches this kind of omission in the future.

---

## Notes For Implementation Agent

### Exact files to modify

1. **`apps/web/src/lib/chess/integrations.ts`**
   - **Function `fetchChessComGames`** (around line 24-32): Add `filename: game.url` to the mapped return object.
   - **Function `fetchLichessGames`** (around line 55-63): Add `filename: 'https://lichess.org/' + game.id` to the stdGame object.

2. **`apps/web/src/components/GameCard.tsx`** (around line 53-58): Wrap the `<Link>` in a conditional `{game.filename && (...)}` to prevent broken links in edge cases.

3. (Optional but recommended) **`packages/types/src/index.ts`** (line 26): Change `filename?: string` to `filename: string` to make it required.

### Components affected
- **Student Dashboard** (`apps/web/src/app/dashboard/page.tsx`) — renders `GameCard`; games will now have correct links.
- **Coach Dashboard** (`apps/web/src/app/coach/(app)/dashboard/page.tsx`) — `game.filename` will now be defined; analyze links will appear and work.
- **Coach Player View** (`apps/web/src/app/coach/(app)/players/[username]/page.tsx`) — same as above.
- **Analysis Page** (`apps/web/src/app/analysis/[filename]/page.tsx`) — will receive proper Chess.com/Lichess game URLs as the `filename` param.

### Dependencies affected
- No external dependencies.
- Local storage format will change slightly (games will now include `filename` field). Old entries stored without `filename` will have broken links until the user re-fetches games from the Onboarding page. This is acceptable.

### Edge cases to test
1. **Chess.com games with different URL formats** — The regex in `fetchPgn` handles:
   - `https://www.chess.com/game/live/1234567890` → matches `(\d+)` capture group.
   - `chess.com/game/live/1234567890` (without protocol) — also matches.
   - The `game.url` from Chess.com API is always a full URL like `https://www.chess.com/game/live/1234567890`, so this regex will always work.
2. **Lichess games** — `https://lichess.org/abcdef12` matches the Lichess regex in `fetchPgn`.
3. **Old localStorage data** — If a user has previously stored games without `filename`, they will still see broken links until they re-fetch. The `GameCard` defensive check (`{game.filename && ...}`) handles this gracefully by hiding the button.
4. **Very long game lists** — The `filename` is already part of the `game.url` which is fetched from the API, no additional storage cost.
5. **Empty archives** — Not affected, already handled by existing error paths.
6. **UUID-based Chess.com games** — Some older Chess.com games use UUIDs. The `fetchChessComPgn` function (in `local-analysis.ts`) has a fallback that checks `g.uuid === gameId`. The URL-based approach should still work since `game.url` contains the UUID in those cases.

---

## Fix Applied (2026-06-23)

### Overview

The bug was fixed by implementing **Solution A (Add `filename` field)** plus additional hardening. After initial implementation, an iteration was needed: using the **full URL** as `filename` caused a **404** because slashes in the URL broke Next.js routing (`[filename]` only matches a single path segment). The corrected approach uses **just the game ID** extracted from the URL.

### Files Modified

| # | File | Change Type | Description |
|---|------|-------------|-------------|
| 1 | `apps/web/src/lib/chess/integrations.ts` | **Root cause fix** | `fetchChessComGames()` — set `filename: game.url.split('/').pop() \|\| game.url` (extracts numeric game ID from full Chess.com URL) |
| 2 | `apps/web/src/lib/chess/integrations.ts` | **Root cause fix** | `fetchLichessGames()` — set `filename: game.id` (uses raw Lichess game ID directly from API) |
| 3 | `apps/web/src/components/GameCard.tsx` | **Defensive hardening** | Wrapped `<Link>` in `{game.filename && (...)}` guard **and** added `encodeURIComponent(game.filename)` in the href |
| 4 | `packages/types/src/index.ts` | **Type safety** | Changed `filename?: string` → `filename: string` so TypeScript catches future omissions |
| 5 | `apps/web/src/app/dashboard/page.tsx` | **Data migration** | Added auto-migration on localStorage load: if `filename` contains `://` or `/`, extracts just the last path segment (the game ID) |

### Detailed Changes

#### 1. `integrations.ts` — Set `filename` at the data source

**Chess.com** (line 32):
```typescript
filename: game.url.split('/').pop() || game.url,
```
- Input: `https://www.chess.com/game/live/170499292956`
- Output: `170499292956` (just the numeric game ID)

**Lichess** (line 64):
```typescript
filename: game.id,
```
- Input: Lichess API provides `game.id` directly (e.g., `abcdef12`)
- Output: `abcdef12` (clean 8-char game ID)

#### 2. `GameCard.tsx` — Prevent broken links (lines 53-60)

Two safety measures:
- **Conditional rendering:** `{game.filename && (...)}` — hides button if `filename` is missing/falsy
- **URL encoding:** `encodeURIComponent(game.filename)` — prevents routing issues if filename contains special characters (consistent with coach page pattern)

#### 3. `types/src/index.ts` — Make `filename` required (line 26)

```typescript
// Before:
filename?: string;
// After:
filename: string;
```

TypeScript will now flag any code that constructs a `Game` object without `filename` at compile time.

#### 4. `dashboard/page.tsx` — Auto-migrate old localStorage data (lines 63-75)

When the dashboard loads games from `localStorage("recentGames")`, it runs a migration:
```typescript
parsed = parsed.map((g: any) => {
  if (g.filename && (g.filename.includes('://') || g.filename.includes('/'))) {
    const segments = g.filename.split('/');
    g.filename = segments[segments.length - 1] || g.filename;
  }
  return g;
});
```
This ensures users who cached game data before the fix (with full URLs as filenames) automatically get clean game IDs without needing to re-fetch.

### Bug Chain Resolution

```
BEFORE:
fetchChessComGames() omits "filename"
  → GameCard renders /analysis/undefined for every game
  → fetchPgn rejects "undefined" string
  → fetchFallbackPgn returns games[0] (most recent game)
  → SAME GAME analyzed every time

AFTER FIX:
fetchChessComGames() sets filename to numeric game ID (e.g., "170499292956")
  → GameCard renders /analysis/170499292956 (clean path, no slashes)
  → fetchPgn matches \d+ regex for Chess.com or [a-z0-9]{8} for Lichess
  → fetchChessComPgn/fetchLichessPgn fetches the CORRECT game
```

### Validation

| Check | Result |
|-------|--------|
| Build (`next build`) | ✅ Compiled successfully — TypeScript, zero errors |
| Route `/analysis/[filename]` | ✅ Now receives clean game IDs (e.g., `1234567890`) instead of full URLs with slashes |
| Old localStorage data | ✅ Auto-migrated on dashboard load + `encodeURIComponent` safety in GameCard |
| Lichess games | ✅ Uses `game.id` directly from API (always a clean 8-char ID) |
| Coach dashboards | ✅ Already use `{game.filename && encodeURIComponent(game.filename)}` pattern |

### Edge Cases Handled

| Edge Case | How It's Handled |
|-----------|-----------------|
| Old localStorage data with full URLs | Dashboard auto-migrates + `encodeURIComponent` safety net |
| Chess.com UUID-based games | Rare edge case; `game.url.split('/').pop()` extracts the UUID; falls through to `fetchFallbackPgn` gracefully |
| Lichess game IDs | Always clean 8-char alphanumeric from the API |
| Missing/null filename | GameCard's `{game.filename && (...)}` hides the button entirely |

### Risks

| Risk | Mitigation |
|------|------------|
| Chess.com API changes URL format | `split('/').pop()` is resilient to most URL formats; `\|\| game.url` fallback preserves original |
| Old localStorage without `filename` at all (pre-fix data) | GameCard hides button; user re-fetches from Onboarding page |
