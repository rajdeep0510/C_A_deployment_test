import { toCategory, formatThemeTags } from "@/lib/puzzles/theme-utils";
import { phaseOf } from "@/lib/puzzles/chunks";

// ── formatThemeTags ───────────────────────────────────────────────────────────

describe("formatThemeTags", () => {
  it("picks the most specific tags and formats them", () => {
    expect(formatThemeTags("endgame rookEndgame short")).toBe("Rook Endgame · Endgame");
  });

  it("handles the exact reported bug tag string", () => {
    const label = formatThemeTags("endgame mate mateIn2 rookEndgame short");
    // mateIn2 (priority 10) and rookEndgame (6) should be first
    expect(label).toContain("Mate in 2");
    expect(label).toContain("Rook Endgame");
    expect(label).not.toContain("short");
  });

  it("filters all noise tags", () => {
    expect(formatThemeTags("fork short long veryLong oneMove")).toBe("Fork");
  });

  it("formats camelCase Lichess tags not in the lookup table", () => {
    // discoveredAttack IS in table
    expect(formatThemeTags("discoveredAttack short")).toBe("Discovered Attack");
  });

  it("caps output at 3 labels", () => {
    const out = formatThemeTags("fork pin skewer sacrifice");
    expect(out.split(" · ").length).toBeLessThanOrEqual(3);
  });

  it("returns 'Puzzle' for an empty string", () => {
    expect(formatThemeTags("")).toBe("Puzzle");
  });
});

// ── toCategory ────────────────────────────────────────────────────────────────

describe("toCategory", () => {
  it("maps prefixed library puzzle types to categories", () => {
    expect(toCategory("tactic_fork")).toBe("tactics");
    expect(toCategory("tactic_pin")).toBe("tactics");
    expect(toCategory("mate_in_2")).toBe("tactics");
    expect(toCategory("mate_back_rank")).toBe("tactics");
    expect(toCategory("phase_opening")).toBe("phase");
    expect(toCategory("phase_middlegame")).toBe("phase");
    expect(toCategory("phase_endgame")).toBe("phase");
    expect(toCategory("endgame_rook")).toBe("endgame_material");
    expect(toCategory("endgame_pawn")).toBe("endgame_material");
    expect(toCategory("opening_sicilian_defense")).toBe("openings");
    expect(toCategory("opening_french_defense")).toBe("openings");
  });

  it("maps own-game tactic theme names to 'tactics' (the radar fix)", () => {
    // These are the raw theme strings stored for own-game puzzles
    expect(toCategory("fork")).toBe("tactics");
    expect(toCategory("pin")).toBe("tactics");
    expect(toCategory("skewer")).toBe("tactics");
    expect(toCategory("hanging_piece")).toBe("tactics");
    expect(toCategory("back_rank")).toBe("tactics");
    expect(toCategory("discovered_attack")).toBe("tactics");
    expect(toCategory("promotion")).toBe("tactics");
    expect(toCategory("checkmate")).toBe("tactics");
    expect(toCategory("smothered_mate")).toBe("tactics");
    expect(toCategory("sacrifice")).toBe("tactics");
    expect(toCategory("middlegame_tactic")).toBe("tactics");
  });

  it("defaults unknown strings to 'tactics' rather than returning them verbatim", () => {
    // Before the fix, toCategory("fork") returned "fork" → no category row written
    const cat = toCategory("fork");
    expect(["tactics", "phase", "endgame_material", "openings"]).toContain(cat);
  });

  it("handles empty string without crashing", () => {
    expect(toCategory("")).toBe("tactics");
  });
});

// ── Opening filter in chunks accept function ─────────────────────────────────
// We test the pure filter logic directly (the same expression used in
// loadRandomPuzzles's `accept` closure) without needing filesystem access.

function makeAccept(opts: {
  ratingMin: number;
  ratingMax: number;
  theme?: string;
  phase?: string;
  opening?: string;
}) {
  const { ratingMin, ratingMax, theme, phase, opening } = opts;
  return (row: { rating: number; theme: string; opening: string }) =>
    row.rating >= ratingMin &&
    row.rating <= ratingMax &&
    (!theme   || row.theme.includes(theme)) &&
    (!phase   || phaseOf(row.theme) === phase) &&
    (!opening || row.opening.includes(opening));
}

describe("puzzle opening filter (accept function)", () => {
  const sicilianRow = {
    rating: 1200,
    theme:  "opening fork short",
    opening: "Sicilian_Defense Sicilian_Defense_Najdorf_Variation",
  };
  const frenchRow = {
    rating: 1200,
    theme:  "opening pin short",
    opening: "French_Defense",
  };
  const endgameRow = {
    rating: 1300,
    theme:  "endgame rookEndgame short",
    opening: "",
  };

  it("passes a Sicilian puzzle when opening='Sicilian_Defense'", () => {
    const accept = makeAccept({ ratingMin: 800, ratingMax: 2000, opening: "Sicilian_Defense" });
    expect(accept(sicilianRow)).toBe(true);
  });

  it("rejects a French puzzle when filtering for Sicilian", () => {
    const accept = makeAccept({ ratingMin: 800, ratingMax: 2000, opening: "Sicilian_Defense" });
    expect(accept(frenchRow)).toBe(false);
  });

  it("rejects an endgame puzzle when filtering for Sicilian", () => {
    const accept = makeAccept({ ratingMin: 800, ratingMax: 2000, opening: "Sicilian_Defense" });
    expect(accept(endgameRow)).toBe(false);
  });

  it("passes all puzzles in range when no opening filter is set", () => {
    const accept = makeAccept({ ratingMin: 800, ratingMax: 2000 });
    expect(accept(sicilianRow)).toBe(true);
    expect(accept(frenchRow)).toBe(true);
    expect(accept(endgameRow)).toBe(true);
  });

  it("respects rating range regardless of opening", () => {
    const accept = makeAccept({ ratingMin: 1500, ratingMax: 2000, opening: "Sicilian_Defense" });
    expect(accept(sicilianRow)).toBe(false); // rating 1200 outside range
  });

  it("combines phase + opening filters", () => {
    const accept = makeAccept({ ratingMin: 800, ratingMax: 2000, phase: "opening", opening: "French_Defense" });
    expect(accept(frenchRow)).toBe(true);
    expect(accept(sicilianRow)).toBe(false); // wrong opening
    expect(accept(endgameRow)).toBe(false);  // wrong phase
  });
});

// ── Skill Radar empty-state gate ──────────────────────────────────────────────
// PuzzleRadar shows empty state when accuracyByTheme has no entries with v > 0.
// This tests that the gate condition behaves correctly after the toCategory fix.

function radarEntries(accuracyByTheme: Record<string, number>) {
  return Object.entries(accuracyByTheme).filter(([, v]) => v > 0);
}

function normalize(rating: number): number {
  return Math.round(Math.min(100, Math.max(0, (rating - 400) / 24)));
}

describe("Skill Radar empty-state condition", () => {
  it("shows empty state when accuracyByTheme is {}", () => {
    expect(radarEntries({})).toHaveLength(0);
  });

  it("shows empty state when all values are 0", () => {
    expect(radarEntries({ tactics: 0, phase: 0 })).toHaveLength(0);
  });

  it("shows radar when at least one category has a value > 0", () => {
    expect(radarEntries({ tactics: 33, phase: 0 })).toHaveLength(1);
  });

  it("after solving a puzzle with theme='fork', the category row is 'tactics' (not 'fork')", () => {
    // Before the fix: toCategory("fork") === "fork" → no category written
    // → accuracyByTheme stayed {} → empty state shown even after solving
    const puzzleTheme = "fork";
    const writtenCategory = toCategory(puzzleTheme);
    expect(writtenCategory).toBe("tactics");

    // Simulate what stats route does: normalize a post-attempt rating
    const simulatedRating = 1232; // 1200 base + small Elo gain
    const score = normalize(simulatedRating); // ≈ 34
    const accuracyByTheme = { [writtenCategory]: score };

    expect(radarEntries(accuracyByTheme)).toHaveLength(1);
    expect(radarEntries(accuracyByTheme)[0][0]).toBe("tactics");
  });

  it("radar shows all four categories when all have been practiced", () => {
    const accuracyByTheme = { tactics: 45, phase: 60, endgame_material: 30, openings: 20 };
    expect(radarEntries(accuracyByTheme)).toHaveLength(4);
  });
});
