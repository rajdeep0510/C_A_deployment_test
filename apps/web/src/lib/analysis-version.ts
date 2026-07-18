// Bump this whenever the client-side WASM analysis pipeline changes in a way
// that would make previously-cached results wrong (e.g. move-classification
// logic changes). analyzeGame() compares this against a cached result's
// stamped version and transparently recomputes on mismatch, so a bug fix
// here self-heals every previously-analyzed game the next time it's opened
// — no manual "Re-analyze" or DB cleanup needed.
//
// v2: fixed the "Forced" classification incorrectly firing on nearly every
// move once MultiPV dropped below 2 (it used to infer "forced" from the
// engine returning only one line, which is also what happens when MultiPV
// itself is 1 — now checked via actual legal-move count instead).
export const CLIENT_ANALYSIS_VERSION = 2;
