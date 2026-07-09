// ── toCategory ────────────────────────────────────────────────────────────────
// Maps a puzzle_type string to one of the four broad radar categories.
// Handles both the prefixed library types ("tactic_fork", "mate_in_1") and
// the raw own-game tactic theme names ("fork", "hanging_piece", …).

const OWN_GAME_TACTICS = new Set([
  "fork", "pin", "skewer", "hanging_piece", "back_rank",
  "discovered_attack", "promotion", "checkmate", "smothered_mate",
  "sacrifice", "middlegame_tactic",
]);

export function toCategory(puzzleType: string): "tactics" | "phase" | "endgame_material" | "openings" {
  if (!puzzleType) return "tactics";
  if (puzzleType.startsWith("tactic_") || puzzleType.startsWith("mate_")) return "tactics";
  if (puzzleType.startsWith("phase_")) return "phase";
  if (puzzleType.startsWith("endgame_")) return "endgame_material";
  if (puzzleType.startsWith("opening_")) return "openings";
  if (OWN_GAME_TACTICS.has(puzzleType)) return "tactics";
  return "tactics";
}

// ── formatThemeTags ───────────────────────────────────────────────────────────
// Converts a raw Lichess space-separated theme string (e.g.
// "endgame mate mateIn2 rookEndgame short") into a readable label
// ("Rook Endgame · Mate in 2").
// Shows the 3 most specific tags; drops generic noise words.

const SKIP_TAGS = new Set([
  "short", "long", "veryLong", "oneMove", "crushing", "defensiveMove",
  "advantage", "equality", "quietMove", "underPromotion",
]);

// Priority: more specific / interesting tags first
const TAG_PRIORITY: Record<string, number> = {
  mateIn1: 10, mateIn2: 10, mateIn3: 10, mateIn4: 10, mateIn5: 10,
  backRankMate: 9, smotheredMate: 9, arabianMate: 9, operaMate: 9,
  fork: 8, pin: 8, skewer: 8, sacrifice: 8, discoveredAttack: 8,
  hangingPiece: 7, promotion: 7, attraction: 7, deflection: 7,
  interference: 7, clearance: 7, trappedPiece: 7,
  pawnEndgame: 6, rookEndgame: 6, bishopEndgame: 6, knightEndgame: 6,
  queenEndgame: 6, queenRookEndgame: 6, mate: 5,
  endgame: 4, middlegame: 3, opening: 3,
};

const TAG_LABELS: Record<string, string> = {
  fork: "Fork", pin: "Pin", skewer: "Skewer", sacrifice: "Sacrifice",
  discoveredAttack: "Discovered Attack", hangingPiece: "Hanging Piece",
  attraction: "Attraction", deflection: "Deflection",
  interference: "Interference", clearance: "Clearance",
  trappedPiece: "Trapped Piece", promotion: "Promotion",
  mateIn1: "Mate in 1", mateIn2: "Mate in 2", mateIn3: "Mate in 3",
  mateIn4: "Mate in 4", mateIn5: "Mate in 5+",
  backRankMate: "Back Rank Mate", smotheredMate: "Smothered Mate",
  arabianMate: "Arabian Mate", operaMate: "Opera Mate", mate: "Checkmate",
  pawnEndgame: "Pawn Endgame", rookEndgame: "Rook Endgame",
  bishopEndgame: "Bishop Endgame", knightEndgame: "Knight Endgame",
  queenEndgame: "Queen Endgame", queenRookEndgame: "Q+R Endgame",
  endgame: "Endgame", middlegame: "Middlegame", opening: "Opening",
};

function camelToWords(s: string): string {
  return s.replace(/([A-Z])/g, " $1").trim();
}

export function formatThemeTags(rawTheme: string): string {
  if (!rawTheme) return "Puzzle";
  const tags = rawTheme.split(" ").filter((t) => t && !SKIP_TAGS.has(t));
  const sorted = [...tags].sort(
    (a, b) => (TAG_PRIORITY[b] ?? 2) - (TAG_PRIORITY[a] ?? 2),
  );
  return sorted
    .slice(0, 3)
    .map((t) => TAG_LABELS[t] ?? camelToWords(t))
    .join(" · ");
}
