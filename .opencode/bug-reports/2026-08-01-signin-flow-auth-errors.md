# Bug Report

## Metadata

* Report Date: 2026-08-01
* Bug Title: Sign-in flow — multiple authentication defects (timing & error-code enumeration, Google verification bypass, set-password dead-end, dead UI branches)
* Severity: High
* Status: Open
* Confidence: High (for top-ranked candidates; medium/low for edge-case items, noted per candidate)

---

## User Report

> "Review the sign-in flow — there are some errors here, identify them and write a bug report."

No specific reproduction was given. Findings below come from full code-path review of the sign-in flow (`/login` page, `/api/auth/login`, Google OAuth start/callback, resend-verification, set-password, verify-email) plus empirical verification of the bcrypt timing behavior.

---

## Reproduction Steps

Reproduction is code-level (no live server needed for most items):

1. **Timing enumeration** — send two `POST /api/auth/login` requests: one with a known/registered ID + wrong password, one with a random non-existent ID + any password. Compare response time (`Date.now()` before/after fetch). Expect ~200–450 ms for the existing account vs ~0–5 ms for the non-existent one.

2. **Error-code enumeration** — submit an ID that does not exist (→ `401 Invalid ID or password`) vs an existing staff ID with unverified email (→ `403 EMAIL_NOT_VERIFIED`), a migrated staff account (→ `403 PASSWORD_RESET_REQUIRED`), and a legacy player with a `*`-prefixed hash (→ `403 PASSWORD_SETUP_REQUIRED`). Each distinct response reveals account existence/state.

3. **Google verification bypass** — register a staff account with email + password but do NOT click the verification link; then sign in via Google with the same email. Login succeeds and `email_verified` is set to `true` in the DB.

4. **set-password dead-end** — log in with a legacy player email whose account has a `*`-prefixed `password_hash`. The login API returns `PASSWORD_SETUP_REQUIRED`; the UI redirects to `/set-password?id=<email>`; submitting fails with `404 Account not found` because the set-password API only resolves chess/lichess usernames.

5. **Dead UI branch** — log in as a pending player. No `PENDING_APPROVAL` alert ever appears on the login page; the user is silently given a session and redirected to `/pending`. The `PENDING_APPROVAL` branch in the page is unreachable.

---

## Expected Behavior

* Login responses should be indistinguishable (status, body, timing) whether the ID exists or not.
* Unverified staff emails must NOT be silently verified by a Google sign-in.
* Users with a pending password-setup step must be able to complete it regardless of whether they entered a username or an email.
* All login-flow UI states should be reachable (or removed if obsolete).
* Brute-force/credential-stuffing protection should exist on the password login endpoint, matching `forgot-password` / `resend-verification`.

---

## Actual Behavior

* Response time reveals whether an account exists (~0–5 ms vs ~200–450 ms).
* Distinct `401`/`403` error codes + `error` strings reveal account existence and state.
* Google sign-in silently sets `email_verified = true` on any pre-existing account with the same email, bypassing the `EMAIL_NOT_VERIFIED` gate.
* Legacy players entering an email at login hit an unrecoverable `404 Account not found` on the set-password step.
* The login page's `PENDING_APPROVAL` alert can never appear; pending players silently receive sessions.
* No rate limiting exists on `/api/auth/login`.

---

## Root Cause Analysis

### Candidate 1 — Broken constant-time mitigation → account enumeration via response timing (Confidence: High)

* Relevant files:
  * `apps/web/src/app/api/auth/login/route.ts:5` — `DUMMY_HASH`
  * `apps/web/src/app/api/auth/login/route.ts:63-66` — hash selection
* Explanation:
  * `DUMMY_HASH = "$2b$12$invalid.hash.for.timing.attack.prevention.only.x"` is NOT a valid bcrypt hash. A valid hash needs exactly 53 chars after `$2b$12$` (22-char salt + 31-char digest); this value has only 48. `bcryptjs` aborts immediately instead of running the 12 rounds.
  * Empirically verified: `bcrypt.compare("password123", DUMMY_HASH)` ≈ **3 ms** (async), while a real `$2b$12$` hash ≈ **217 ms** (async).
  * Therefore the "always run bcrypt" intent fails: non-existent IDs fail fast, existing accounts burn full bcrypt cost → ~200–450 ms timing difference → account enumeration.
  * Secondary leak in the same block: when `user.password_hash` is `NULL` (Google-only accounts), the ternary at line 65 yields `null` (not `DUMMY_HASH`), so `bcrypt.compare(password, null)` throws and the `.catch(() => false)` path also completes in ~0–1 ms.
* Failure point: line 66 (`verifyPassword`) executes no real work for dummy/null hashes.
* When introduced: `DUMMY_HASH` added in commit `8b2961ca` ("added google auth", 2026-07-25). The WIP rewrite (uncommitted) preserves the defect.

### Candidate 2 — Account-state enumeration via distinct HTTP status + error codes (Confidence: High)

* Relevant file: `apps/web/src/app/api/auth/login/route.ts:68-97`
* Explanation:
  * Non-existent user or wrong password → `401 "Invalid ID or password"`.
  * Existing, unverified staff → `403 EMAIL_NOT_VERIFIED`.
  * Existing migrated staff → `403 PASSWORD_RESET_REQUIRED`.
  * Existing legacy player with `*`-prefixed hash → `403 PASSWORD_SETUP_REQUIRED`.
  * Each 403 confirms the account exists and leaks its state.
* Inconsistency: `forgot-password/route.ts` and `resend-verification/route.ts` deliberately return uniform responses ("If this email exists…") to prevent enumeration; the login route does the opposite.

### Candidate 3 — Google callback silently marks existing unverified accounts as verified (Confidence: High)

* Relevant files:
  * `apps/web/src/app/api/auth/google/callback/route.ts:51-58`
  * `apps/web/src/lib/google-auth.ts:40-46` (returns `emailVerified` — never consumed)
* Explanation:
  * When an `app_users` row already exists with the same email but `email_verified = false` (staff who registered with password but never clicked the link), the callback runs `update({ data: { google_sub: profile.sub, email_verified: true } })` and signs the user in.
  * This bypasses the `EMAIL_NOT_VERIFIED` gate enforced by the password login route (line 92-97).
  * The callback never checks `profile.emailVerified` from the Google id_token before trusting the email for linking.
* When introduced: commit `8b2961ca` ("added google auth").

### Candidate 4 — No rate limiting / brute-force protection on the password login endpoint (Confidence: High)

* Relevant file: `apps/web/src/app/api/auth/login/route.ts` (entire route — no limiter)
* Explanation:
  * `forgot-password` and `resend-verification` have in-memory limiters (3 req / 10 min per key); `/api/auth/login` has none.
  * Combined with Candidates 1–2, this enables bulk enumeration and credential stuffing without throttling.

### Candidate 5 — Dead `PENDING_APPROVAL` branch; pending players silently issued sessions (Confidence: High)

* Relevant files:
  * `apps/web/src/app/login/page.tsx:78-82, 316-320` (branch + alert)
  * `apps/web/src/app/api/auth/login/route.ts` (current unified flow — never returns `PENDING_APPROVAL`)
* Explanation:
  * The committed player-login path returned `403 PENDING_APPROVAL` and NO session for non-approved players. The uncommitted WIP rewrite removed that branch and now creates a session for any player (pending or rejected), redirecting to `/pending`.
  * Result: the page's `pendingApproval` state and alert are dead code, and the pending-approval UX changed silently. (Note: `/pending` requires an authenticated session to render, so session-for-pending is arguably intentional — but the stale UI branch is not.)
  * The `set-password` route (`apps/web/src/app/api/auth/set-password/route.ts:39-44`) still returns `PENDING_APPROVAL`, so the string is inconsistently handled across flows.

### Candidate 6 — set-password dead-end when the user enters an email (Confidence: Medium-High)

* Relevant files:
  * `apps/web/src/app/api/auth/login/route.ts:73-76, 79-84` (returns `id: idLower` which may be an email)
  * `apps/web/src/app/api/auth/set-password/route.ts:30-37` (looks up players by `chess_username` / `lichess_username` only)
* Explanation:
  * A legacy player with a `*`-prefixed `password_hash` who logs in with their EMAIL gets `PASSWORD_SETUP_REQUIRED` with `id` = email.
  * `/set-password` resolves the account only by username → `404 "Account not found"`. The user cannot set a password and cannot sign in (only works if they enter the username instead of the email).
  * Also note the UI copy at `login/page.tsx:213` ("Account ready! Enter your chess username to sign in.") doesn't mention the password requirement.

### Candidate 7 — `isStaff` heuristic mislabels player email logins (Confidence: High, severity Low)

* Relevant file: `apps/web/src/app/login/page.tsx:29, 273-275`
* Explanation: `const isStaff = id.includes("@")`. Players can legitimately log in with their email (the route resolves `player.email`); those users get the "Coach / Academy / Admin login" icon + hint text, which is wrong and confusing.

### Candidate 8 — Stale error not cleared when only the password field changes (Confidence: High, severity Low)

* Relevant file: `apps/web/src/app/login/page.tsx:294`
* Explanation: `onChange={(e) => setPassword(e.target.value)}` doesn't call `clearAlerts()`, while the ID field does (line 266). After a failed submit, editing the password keeps the old error visible.

### Candidate 9 — Resend-verification swallows failures (Confidence: High, severity Low)

* Relevant file: `apps/web/src/app/login/page.tsx:99-108`
* Explanation: no try/catch, response status ignored; `setResendDone(true)` runs unconditionally, so a network/API failure still shows "Verification email sent — check your inbox."

### Candidate 10 — Google OAuth state cookie not cleared on error redirects (Confidence: Medium, severity Low)

* Relevant file: `apps/web/src/app/api/auth/google/callback/route.ts:17-19`
* Explanation: on `google_error` / `missing_code` / `invalid_state` paths the one-shot `google_oauth_state` cookie is not cleared (only cleared on success, line 89). Minor: 10-minute TTL limits exposure.

---

## Evidence

* **Timing test (bcryptjs, this repo's dependency):**
  ```
  DUMMY_HASH  = "$2b$12$invalid.hash.for.timing.attack.prevention.only.x"
  compare(password, DUMMY_HASH)  → 3 ms   (async) / 0 ms (sync)  — resolves, does NOT run rounds
  compare(password, real $2b$12$ hash) → 217 ms (async) / 454 ms (sync)
  compare(password, null) → throws "Illegal arguments: string, object" → ~1 ms via catch
  ```
  Reason: DUMMY_HASH has 48 chars after the prefix; a valid bcrypt hash requires 53.

* **Login route (uncommitted WIP) — enumeration surface:**
  ```ts
  // apps/web/src/app/api/auth/login/route.ts
  if (!user)        return NextResponse.json({ error: "Invalid ID or password" }, { status: 401 });
  if (isMigrated)   return NextResponse.json({ error: "PASSWORD_RESET_REQUIRED", ... }, { status: 403 });
  if (hasPlaceholder) return NextResponse.json({ error: "PASSWORD_SETUP_REQUIRED", ... }, { status: 403 });
  if (!passwordOk)  return NextResponse.json({ error: "Invalid ID or password" }, { status: 401 });
  if (user.profile && !user.email_verified) return NextResponse.json({ error: "EMAIL_NOT_VERIFIED", ... }, { status: 403 });
  ```

* **Google callback — unconditional re-verification:**
  ```ts
  // apps/web/src/app/api/auth/google/callback/route.ts:51-58
  const byEmail = await prisma.app_users.findUnique({ where: { email_lower: emailLower } });
  if (byEmail) {
    user = await prisma.app_users.update({
      where: { id: byEmail.id },
      data: { google_sub: profile.sub, email_verified: true },   // <-- bypasses EMAIL_NOT_VERIFIED gate
    });
  }
  ```
  `profile.emailVerified` (returned by `exchangeCodeForProfile`) is never checked.

* **Git provenance:**
  * `DUMMY_HASH` + Google callback re-verification → commit `8b2961ca` ("added google auth", 2026-07-25).
  * Removal of `PENDING_APPROVAL` from the login route + unified player/staff login → **uncommitted working-tree changes** (`git diff` on `login/route.ts`).
  * Prior committed player path returned `403 PENDING_APPROVAL` and created no session; current code creates sessions for pending/rejected players.

* **No credentials/secrets appear in the investigated code paths; no redaction required.**

---

## Impact Assessment

* **Who is affected:**
  * All users of the password sign-in flow (enumeration/timing exposure).
  * Staff who registered by email but never verified (Google verification bypass).
  * Legacy players with `*`-prefixed password hashes who type their email at login (set-password dead-end — cannot sign in).
  * Pending players (silent behavior change; no approval notice on the login page).

* **What functionality breaks:**
  * Completing password setup is impossible for some users (Candidate 6).
  * Pending-approval messaging never appears (Candidate 5).
  * Confusing UX for player email logins (Candidate 7).

* **Security impact:**
  * Account existence + state enumeration via timing (High) and distinct status codes (Medium).
  * Email-verification bypass via Google sign-in (Medium-High) — weakens the "verified email" trust boundary used for staff gating and account recovery.
  * No throttling → credential-stuffing / brute-force attack surface (Medium).

* **Performance impact:**
  * None notable; the timing leak is a *consequence* of the (failed) performance-equalization attempt.

---

## Possible Solutions

### Solution A — Fix the dummy hash + NULL-hash path

* Description: Replace `DUMMY_HASH` with a real bcrypt hash of a random string (e.g., generate `bcrypt.hashSync("dummy", 12)` at module load), and force it for non-verifiable hashes:
  ```ts
  const hashToVerify = user && user.password_hash && !isMigrated && !hasPlaceholder
    ? user.password_hash
    : DUMMY_HASH;   // real 12-round hash, never null
  ```
* Pros:
  * Restores constant-time responses for non-existent / migrated / placeholder / NULL-hash accounts.
  * Minimal change, single file.
* Cons:
  * Does not address status-code enumeration (Candidate 2).

### Solution B — Uniform responses for all failure cases

* Description: Return the same `401 { error: "Invalid ID or password" }` (or a single generic body) for non-existent, wrong-password, unverified-email, migrated, and placeholder accounts; communicate special states only on success (e.g., via a `next_step` field AFTER a valid password is confirmed), or handle them client-side via the success payload.
* Pros:
  * Eliminates account-state enumeration (Candidate 2) and simplifies client logic.
  * Aligns with the existing policy in `forgot-password` / `resend-verification`.
* Cons:
  * Requires reworking the login page's 403 branches (dead-code cleanup, Candidate 5) and the `set-password` handoff.

### Solution C — Harden Google callback

* Description: In `google/callback/route.ts`, before linking/creating by email:
  * require `profile.emailVerified === true` for the "link by email" path;
  * do NOT flip `email_verified` to `true` if the existing account was created with a password and is unverified — instead require the normal verification flow;
  * or at minimum gate re-verification on Google's `email_verified` claim.
* Pros: Closes the verification bypass; keeps UX for Google-only users.
* Cons: Needs product decision on how to handle an existing unverified staff account signing in via Google (e.g., surface "verify email first").

### Solution D — Fix the set-password handoff

* Description: In `apps/web/src/app/api/auth/set-password/route.ts`, resolve the account by player email / `app_users.email_lower` as well as username; alternatively, in `login/route.ts` return the player's username (not the raw ID) for `PASSWORD_SETUP_REQUIRED`.
* Pros: Unblocks users stuck at the dead-end; small, targeted change.
* Cons: Need to disambiguate when an email maps to both a player and an `app_user`.

### Solution E — Rate-limit the login endpoint

* Description: Add an in-memory limiter (like `forgot-password`) keyed by IP + normalized ID, e.g., 5 attempts / 15 min, with a generic 429 body.
* Pros: Reduces brute-force / stuffing exposure.
* Cons: In-memory maps don't scale across serverless instances (acceptable for MVP; note as follow-up).

### Solution F — Fix login-page UX nits

* Description: Remove/replace the dead `PENDING_APPROVAL` branch; call `clearAlerts()` on password change; add try/catch + status handling to `handleResend`; fix the `isStaff` label to "Email or Chess ID" for player logins; mention the password requirement in the `justRegistered` banner; clear the Google state cookie on error redirects.
* Pros: Removes confusion and dead code; low risk.
* Cons: Cosmetic/UX only; multiple small edits.

---

## Files Involved

* `apps/web/src/app/api/auth/login/route.ts` (Candidates 1, 2, 4, 5, 6)
* `apps/web/src/app/api/auth/google/callback/route.ts` (Candidates 3, 10)
* `apps/web/src/app/api/auth/set-password/route.ts` (Candidate 6)
* `apps/web/src/app/api/auth/google/start/route.ts` (context for state cookie)
* `apps/web/src/app/api/auth/forgot-password/route.ts` (rate-limit precedent; Candidate 4)
* `apps/web/src/app/api/auth/resend-verification/route.ts` (rate-limit precedent; Candidate 4)
* `apps/web/src/lib/auth.ts` (verifyPassword / resolvePostLoginRedirect context)
* `apps/web/src/lib/google-auth.ts` (returns unused `emailVerified`; Candidate 3)
* `apps/web/src/app/login/page.tsx` (Candidates 5, 7, 8, 9)
* `apps/web/src/app/set-password/page.tsx` (Candidate 6)
* `apps/web/prisma/google_auth_migration.sql` (password_hash nullable → NULL-hash path; Candidate 1)

---

## Recommended Fix Order

1. **Immediate fixes (security):**
   * Candidate 1 — valid `DUMMY_HASH` + never pass `null` to bcrypt.
   * Candidate 3 — Google callback must check `profile.emailVerified` and not silently re-verify unverified staff accounts.
   * Candidate 4 — add rate limiting to `/api/auth/login`.

2. **Related fixes (functional):**
   * Candidate 2 — uniform failure responses (and rework client 403 branches).
   * Candidate 6 — set-password resolution by email as well as username.
   * Candidate 5 — remove dead `PENDING_APPROVAL` branch or re-introduce the route response deliberately.

3. **Preventative improvements (UX/hygiene):**
   * Candidates 7, 8, 9, 10 — label/clear-alert/error-handling/cookie-cleanup fixes.

---

## Notes For Implementation Agent

* **Important:** the login route is currently in a **non-committed rewritten state** (`git diff` shows the unified player/staff flow). Any fix must be based on the **working-tree** version, not `HEAD`.
* Exact files to modify:
  * `apps/web/src/app/api/auth/login/route.ts`
    * Line 5: replace `DUMMY_HASH` with a real `$2b$12$`-cost hash of a random value (constant, computed once).
    * Lines 63-66: use `DUMMY_HASH` whenever `!user || !user.password_hash || isMigrated || hasPlaceholder`.
    * Decide + implement Candidate 2 uniform responses (this will also obsolete the page's 403 branches).
    * Add rate limiting (Candidate 4).
  * `apps/web/src/app/api/auth/google/callback/route.ts`
    * Check `profile.emailVerified` before linking by email; stop forcing `email_verified: true` on existing unverified password accounts.
    * Clear `google_oauth_state` cookie on error paths.
  * `apps/web/src/app/api/auth/set-password/route.ts`
    * Resolve by `player.email` / `app_users.email_lower` in addition to username (Candidate 6).
  * `apps/web/src/app/login/page.tsx`
    * `clearAlerts()` on password change (line 294).
    * Fix/remove `PENDING_APPROVAL` dead branch (lines 78-82, 316-320).
    * try/catch + status handling in `handleResend` (lines 99-108).
    * Rework `isStaff` copy so player email logins are labeled correctly (line 29, 273-275).
    * Update `justRegistered` banner to mention password (line 213).
* Components affected: login page, login API, Google OAuth flow, set-password flow.
* Dependencies affected: `bcryptjs` (hash validation), `prisma` (query changes), `google-auth-library` (verifyIdToken payload).
* Edge cases to test:
  * Non-existent ID vs real ID with wrong password — response time within ~10% and identical status/body (Candidate 1 & 2).
  * Google sign-in with an unverified staff email — must NOT bypass verification.
  * Legacy `*`-hash player logging in via email vs username (both must reach a working set-password step).
  * Pending and rejected player/coach login — confirm intended redirect and no dead UI states.
  * Rate limiter: >5 rapid login attempts → generic 429, no account-state leakage.
  * Player with both chess.com and lichess usernames; player email identical to a staff email (disambiguation).

---

## Success Criteria

* All bullet points above addressed per candidate; report saved in `.opencode/bug-reports/` relative to repo root.
* Root cause identified/narrowed with confidence ranked per candidate.
* Evidence documented (empirically verified timing values; code refs with line numbers).
* Impact assessed; implementation guidance provided.
* No existing unrelated report overwritten (`2026-06-23-analysis-filename-undefined.md` untouched).
