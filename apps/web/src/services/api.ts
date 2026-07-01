const BASE_URL = "";

function apiFetch(url: string, options?: RequestInit) {
  return fetch(url, options);
}

// Deduplicates in-flight GET requests: if the same URL is already being fetched,
// return the existing promise instead of firing a second network request.
const inFlight = new Map<string, Promise<any>>();

function dedupedGet(url: string): Promise<any> {
  const existing = inFlight.get(url);
  if (existing) return existing;
  const p = fetch(url)
    .then((r) => {
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .finally(() => inFlight.delete(url));
  inFlight.set(url, p);
  return p;
}

export async function checkHealth() {
  try {
    const res = await apiFetch(`${BASE_URL}/`);
    return res.ok;
  } catch (e) {
    return false;
  }
}

export async function fetchGames(platform, username, limit = 10) {
  const res = await apiFetch(
    `${BASE_URL}/api/games?platform=${platform}&username=${username}&limit=${limit}`,
  );
  if (!res.ok) throw new Error("Failed to fetch games");
  return res.json();
}

export async function getStats(username) {
  const res = await apiFetch(`${BASE_URL}/api/stats/${username}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

export async function analyzeGame(username: string, filename: string): Promise<any> {
  const { engineConfig } = await import("@/lib/engine-config");
  if (!engineConfig.enabled) {
    throw new Error("Client-side analysis is disabled. Set NEXT_PUBLIC_ANALYSIS_ENABLE_WASM=true");
  }

  const { isWasmSupported } = await import("@/lib/engine/wasm-detect");
  if (typeof window === "undefined" || !isWasmSupported()) {
    throw new Error("WebAssembly is not supported in this browser. Please use a modern browser like Chrome, Firefox, or Edge.");
  }

  // Check Supabase for a cached completed analysis
  const cached = await fetch(
    `/api/analyze?username=${encodeURIComponent(username)}&filename=${encodeURIComponent(filename)}`
  ).then((r) => (r.ok ? r.json() : null)).catch(() => null);

  if (cached?.result) return cached.result;

  // Create a pending job so the result can be saved back
  const job = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, filename }),
  }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

  const { analyzeLocally } = await import("@/services/local-analysis");
  const result = await analyzeLocally(username, filename);

  // Persist the result so future visits skip re-analysis
  if (job?.id) {
    fetch("/api/analyze", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: job.id, status: "completed", result }),
    }).catch(() => {});
  }

  return result;
}

export async function batchAnalyze(username: string, limit = 50) {
  const res = await apiFetch(
    `${BASE_URL}/api/analyze/${username}/batch?limit=${limit}`,
  );
  if (!res.ok) throw new Error("Batch analysis failed");
  return res.json();
}

export async function createBatchJob(username: string, game_urls: string[]): Promise<any> {
  const res = await apiFetch(`${BASE_URL}/api/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, game_urls }),
  });
  if (!res.ok) throw new Error("Failed to create batch job");
  return res.json();
}

export async function getBatchJob(jobId: string): Promise<any> {
  const res = await apiFetch(`${BASE_URL}/api/batch?jobId=${encodeURIComponent(jobId)}`);
  if (!res.ok) throw new Error("Failed to fetch batch job");
  return res.json();
}

export async function getBatchJobs(username: string): Promise<any[]> {
  const res = await apiFetch(`${BASE_URL}/api/batch?username=${encodeURIComponent(username)}`);
  if (!res.ok) return [];
  return res.json();
}

export function getReport(username, limit = 50) {
  return dedupedGet(`${BASE_URL}/api/report/${username}?limit=${limit}`);
}

export function getTrainingPlan(username, limit = 50) {
  return dedupedGet(
    `${BASE_URL}/api/training-plan/${username}?limit=${limit}`,
  );
}

export function getOpenings(username, limit = 50) {
  return dedupedGet(`${BASE_URL}/api/openings/${username}?limit=${limit}`);
}

export type Annotation = {
  id: string;
  coach_id: string;
  player_username: string;
  filename: string;
  move_index: number;
  note: string;
};

export async function fetchAnnotations(
  coachId: string,
  playerUsername: string,
  filename: string,
): Promise<Annotation[]> {
  const res = await fetch(
    `/api/annotations?coach_id=${encodeURIComponent(coachId)}&player_username=${encodeURIComponent(playerUsername)}&filename=${encodeURIComponent(filename)}`,
  );
  if (!res.ok) return [];
  return res.json();
}

export async function saveAnnotation(payload: {
  coach_id: string;
  player_username: string;
  filename: string;
  move_index: number;
  note: string;
}): Promise<Annotation | null> {
  const res = await fetch("/api/annotations", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function deleteAnnotation(id: string): Promise<void> {
  await fetch(`/api/annotations/${id}`, { method: "DELETE" });
}

// ── Puzzle API ────────────────────────────────────────────────────────────────

export async function getPuzzleQueue(username: string, limit = 10, phase?: string) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (phase) params.set("phase", phase);
  const res = await apiFetch(`${BASE_URL}/api/puzzles/${username}/queue?${params}`);
  if (!res.ok) throw new Error("Failed to fetch puzzle queue");
  return res.json();
}

export async function generatePuzzles(username: string) {
  const res = await apiFetch(`${BASE_URL}/api/puzzles/${username}/generate`);
  if (!res.ok) throw new Error("Failed to generate puzzles");
  return res.json();
}

export async function recordPuzzleAttempt(
  username: string,
  puzzleId: string,
  solved: boolean,
  timeTakenSeconds: number,
  puzzleRating?: number,
  source: "own_game" | "library" = "own_game",
  puzzleType = "",
) {
  const res = await apiFetch(
    `${BASE_URL}/api/puzzles/${username}/${encodeURIComponent(puzzleId)}/attempt`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        solved,
        time_taken_seconds: timeTakenSeconds,
        puzzle_rating:      puzzleRating ?? null,
        source,
        puzzle_type:        puzzleType,
      }),
    },
  );
  if (!res.ok) throw new Error("Failed to record attempt");
  return res.json();
}

export async function getPlayerRating(username: string) {
  const res = await apiFetch(`${BASE_URL}/api/puzzles/${username}/rating`);
  if (!res.ok) return null;
  return res.json();
}

export async function getCalibrationPuzzles(username: string) {
  const res = await apiFetch(`${BASE_URL}/api/puzzles/${username}/calibrate`);
  if (!res.ok) throw new Error("Failed to fetch calibration puzzles");
  return res.json();
}

export async function submitCalibration(
  username: string,
  results: Array<[number, boolean]>,
) {
  const res = await apiFetch(`${BASE_URL}/api/puzzles/${username}/calibrate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ results }),
  });
  if (!res.ok) throw new Error("Failed to submit calibration");
  return res.json();
}

export async function getPuzzleStats(username: string) {
  const res = await apiFetch(`${BASE_URL}/api/puzzles/${username}/stats`);
  if (!res.ok) throw new Error("Failed to fetch puzzle stats");
  return res.json();
}

export async function getThemedPuzzles(
  theme: string,
  minDifficulty = 0,
  maxDifficulty = 9999,
  limit = 10,
) {
  const res = await apiFetch(
    `${BASE_URL}/api/puzzles/themed/${theme}?min_difficulty=${minDifficulty}&max_difficulty=${maxDifficulty}&limit=${limit}`,
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch themed puzzles");
  return res.json();
}

export async function submitRushScore(payload: {
  username: string;
  score: number;
  duration_seconds: number;
  wrong_count: number;
  end_reason: "time" | "strikes";
}) {
  const res = await apiFetch(`${BASE_URL}/api/puzzles/rush/score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to submit rush score");
  return res.json();
}

export async function getRushLeaderboard(
  duration: 180 | 300,
  period: "week" | "all" = "week",
  limit = 10,
  username?: string,
) {
  const params = new URLSearchParams({
    duration: String(duration),
    period,
    limit: String(limit),
  });
  if (username) params.set("username", username);
  const res = await apiFetch(`${BASE_URL}/api/puzzles/rush/leaderboard?${params}`);
  if (!res.ok) throw new Error("Failed to fetch rush leaderboard");
  return res.json();
}

export async function getRushPuzzles(count = 60) {
  const res = await apiFetch(`${BASE_URL}/api/puzzles/rush?count=${count}`);
  if (!res.ok) throw new Error("Failed to fetch rush puzzles");
  return res.json();
}

// Maps our UI puzzle types to Lichess theme tags used in the chunks data
const PUZZLE_TYPE_TO_THEME: Record<string, string | undefined> = {
  tactic_fork:               "fork",
  tactic_pin:                "pin",
  tactic_skewer:             "skewer",
  tactic_sacrifice:          "sacrifice",
  tactic_discovered_attack:  "discoveredAttack",
  mate_in_1:                 "mateIn1",
  mate_in_2:                 "mateIn2",
  mate_in_3:                 "mateIn3",
  mate_in_4plus:             "mateIn4",
  mate_back_rank:            "backRankMate",
  mate_smothered:            "smotheredMate",
  mate_arabian:              "arabianMate",
  mate_opera:                "operaMate",
  endgame_pawn:              "pawnEndgame",
  endgame_rook:              "rookEndgame",
  endgame_bishop:            "bishopEndgame",
  endgame_knight:            "knightEndgame",
  endgame_queen:             "queenEndgame",
};

const PUZZLE_TYPE_TO_PHASE: Record<string, string | undefined> = {
  phase_opening:    "opening",
  phase_middlegame: "middlegame",
  phase_endgame:    "endgame",
};

const DIFFICULTY_RANGES: Record<string, [number, number]> = {
  beginner:     [200,  1000],
  intermediate: [1000, 1400],
  advanced:     [1400, 1800],
  expert:       [1800, 2500],
};

export async function getLibraryPuzzles(
  puzzleType = "phase_middlegame",
  difficulty  = "intermediate",
  limit = 20,
) {
  const [ratingMin, ratingMax] = DIFFICULTY_RANGES[difficulty] ?? [1000, 1400];
  const params = new URLSearchParams({
    rating_min: String(ratingMin),
    rating_max: String(ratingMax),
    limit: String(limit),
  });

  const theme = PUZZLE_TYPE_TO_THEME[puzzleType];
  const phase = PUZZLE_TYPE_TO_PHASE[puzzleType];
  if (theme) params.set("theme", theme);
  if (phase) params.set("phase", phase);

  const res = await apiFetch(`${BASE_URL}/api/puzzles/library?${params}`);
  if (!res.ok) throw new Error("Failed to fetch library puzzles");
  return res.json();
}
