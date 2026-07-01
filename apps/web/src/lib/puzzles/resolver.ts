const BASE_URL = process.env.PUZZLE_RELEASE_BASE_URL!;

export type EloBracket = "beginner" | "intermediate" | "advanced" | "expert" | "master";

// Types that have NO elo-bracket split — single file per type.
const NO_BRACKET_TYPES = new Set([
  // Endgame material
  "endgame_bishop",
  "endgame_knight",
  "endgame_queen",
  "endgame_queen_rook",
  // Named mate patterns
  "mate_arabian",
  "mate_smothered",
  "mate_opera",
  "mate_pillsburys",
  "mate_epaulette",
  // Mate in 4+ (single flat file, no bracket)
  "mate_in_4plus",
  // ── 1.e4 Openings ────────────────────────────────────────────────────────────
  "opening_french_defense",
  "opening_caro-kann_defense",
  "opening_italian_game",
  "opening_ruy_lopez",
  "opening_scotch_game",
  "opening_kings_gambit_accepted",
  "opening_kings_gambit_declined",
  "opening_scandinavian_defense",
  "opening_alekhine_defense",
  "opening_pirc_defense",
  "opening_modern_defense",
  "opening_vienna_game",
  "opening_bishops_opening",
  "opening_four_knights_game",
  "opening_philidor_defense",
  "opening_russian_game",
  "opening_kings_pawn_game",
  // ── 1.d4 Openings ────────────────────────────────────────────────────────────
  "opening_queens_gambit_declined",
  "opening_queens_gambit_accepted",
  "opening_queens_pawn_game",
  "opening_slav_defense",
  "opening_kings_indian_defense",
  "opening_benoni_defense",
  "opening_indian_defense",
  "opening_nimzo-larsen_attack",
  "opening_nimzowitsch_defense",
  "opening_zukertort_opening",
  // ── Other ─────────────────────────────────────────────────────────────────────
  "opening_english_opening",
  "opening_dutch_defense",
  "opening_englund_gambit",
]);

// Chunk counts for (type_bracket) keys.  0 = single file (no _N suffix).
const CHUNK_MAP: Record<string, number> = {
  // ── Phase › Opening ──────────────────────────────────────────────────────────
  "phase_opening_beginner":        0,
  "phase_opening_intermediate":    0,
  "phase_opening_advanced":        0,
  "phase_opening_expert":          0,
  "phase_opening_master":          0,
  // ── Phase › Middlegame ───────────────────────────────────────────────────────
  "phase_middlegame_beginner":     6,
  "phase_middlegame_intermediate": 7,
  "phase_middlegame_advanced":     7,
  "phase_middlegame_expert":       6,
  "phase_middlegame_master":       4,
  // ── Phase › Endgame ──────────────────────────────────────────────────────────
  "phase_endgame_beginner":        8,
  "phase_endgame_intermediate":    9,
  "phase_endgame_advanced":        7,
  "phase_endgame_expert":          5,
  "phase_endgame_master":          4,
  // ── Endgame material › Pawn ──────────────────────────────────────────────────
  "endgame_pawn_beginner":         0,
  "endgame_pawn_intermediate":     0,
  "endgame_pawn_advanced":         0,
  "endgame_pawn_expert":           0,
  "endgame_pawn_master":           0,
  // ── Endgame material › Rook ──────────────────────────────────────────────────
  "endgame_rook_beginner":         0,
  "endgame_rook_intermediate":     0,
  "endgame_rook_advanced":         0,
  "endgame_rook_expert":           0,
  "endgame_rook_master":           0,
  // ── Tactic › Fork ────────────────────────────────────────────────────────────
  "tactic_fork_beginner":          2,
  "tactic_fork_intermediate":      3,
  "tactic_fork_advanced":          2,
  "tactic_fork_expert":            2,
  "tactic_fork_master":            0,
  // ── Tactic › Pin ─────────────────────────────────────────────────────────────
  "tactic_pin_beginner":           0,
  "tactic_pin_intermediate":       0,
  "tactic_pin_advanced":           0,
  "tactic_pin_expert":             0,
  "tactic_pin_master":             0,
  // ── Tactic › Sacrifice ───────────────────────────────────────────────────────
  "tactic_sacrifice_beginner":     0,
  "tactic_sacrifice_intermediate": 0,
  "tactic_sacrifice_advanced":     2,
  "tactic_sacrifice_expert":       2,
  "tactic_sacrifice_master":       0,
  // ── Tactic › Discovered Attack ───────────────────────────────────────────────
  "tactic_discovered_attack_beginner":     0,
  "tactic_discovered_attack_intermediate": 0,
  "tactic_discovered_attack_advanced":     0,
  "tactic_discovered_attack_expert":       0,
  "tactic_discovered_attack_master":       0,
  // ── Tactic › Skewer ──────────────────────────────────────────────────────────
  "tactic_skewer_beginner":        0,
  "tactic_skewer_intermediate":    0,
  "tactic_skewer_advanced":        0,
  "tactic_skewer_expert":          0,
  "tactic_skewer_master":          0,
  // ── Mate › In 1 ──────────────────────────────────────────────────────────────
  "mate_in_1_beginner":            6,
  "mate_in_1_intermediate":        3,
  "mate_in_1_advanced":            0,
  "mate_in_1_expert":              0,
  "mate_in_1_master":              0,
  // ── Mate › In 2 ──────────────────────────────────────────────────────────────
  "mate_in_2_beginner":            4,
  "mate_in_2_intermediate":        3,
  "mate_in_2_advanced":            2,
  "mate_in_2_expert":              0,
  "mate_in_2_master":              0,
  // ── Mate › In 3 ──────────────────────────────────────────────────────────────
  "mate_in_3_beginner":            0,
  "mate_in_3_intermediate":        0,
  "mate_in_3_advanced":            0,
  "mate_in_3_expert":              0,
  "mate_in_3_master":              0,
  // ── Mate › Back Rank ─────────────────────────────────────────────────────────
  "mate_back_rank_beginner":       2,
  "mate_back_rank_intermediate":   0,
  "mate_back_rank_advanced":       0,
  "mate_back_rank_expert":         0,
  "mate_back_rank_master":         0,
  // ── Opening with elo split (Sicilian only) ───────────────────────────────────
  "opening_sicilian_defense_beginner":     0,
  "opening_sicilian_defense_intermediate": 0,
  "opening_sicilian_defense_advanced":     0,
  "opening_sicilian_defense_expert":       0,
  "opening_sicilian_defense_master":       0,
};

// For tactic_skewer there are only 2 un-bracketed chunks (_1, _2).
// We handle these edge cases by falling back to the no-bracket path.
const SKEWER_CHUNKS: Record<string, number> = {
  "tactic_skewer": 2,
};

export function resolveCsvUrl(puzzleType: string, bracket: EloBracket): string {
  // Types with no elo bracket — single flat file
  if (NO_BRACKET_TYPES.has(puzzleType)) {
    return `${BASE_URL}/${puzzleType}.csv`;
  }

  // tactic_skewer has un-bracketed chunks (_1/_2), ignore difficulty
  if (puzzleType in SKEWER_CHUNKS) {
    const n = SKEWER_CHUNKS[puzzleType];
    const chunk = Math.floor(Math.random() * n) + 1;
    return `${BASE_URL}/${puzzleType}_${chunk}.csv`;
  }

  // Standard bracketed types
  const key    = `${puzzleType}_${bracket}`;
  const chunks = CHUNK_MAP[key] ?? 0;
  const name   = chunks === 0
    ? key
    : `${key}_${Math.floor(Math.random() * chunks) + 1}`;
  return `${BASE_URL}/${name}.csv`;
}
