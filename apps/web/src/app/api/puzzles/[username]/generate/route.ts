import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// ── Theme detection ──────────────────────────────────────────────────────────
const ERROR_NATURE_MAP: Record<string, string> = {
  fork:            "fork",
  pin:             "pin",
  skewer:          "skewer",
  "back_rank":     "back_rank",
  discovered:      "discovered_attack",
  promotion:       "promotion",
  checkmate:       "checkmate",
  "smothered":     "smothered_mate",
  sacrifice:       "sacrifice",
  hanging:         "hanging_piece",
  blunder:         "hanging_piece",
  capture:         "hanging_piece",
};

function deriveTheme(move: any): string {
  const nature = (move.error_nature ?? "").toLowerCase();
  for (const [key, theme] of Object.entries(ERROR_NATURE_MAP)) {
    if (nature.includes(key)) return theme;
  }
  // Fallback: detect capture from SAN (e.g. "Nxf7" contains "x")
  const san = (move.san ?? "").toLowerCase();
  if (san.includes("x")) return "hanging_piece";  // missed capture
  if (san.includes("+") || san.includes("#")) return "checkmate";
  const cpLoss = move.cp_loss ?? 0;
  if (cpLoss > 400) return "hanging_piece";        // large blunder = hanging piece likely
  return "middlegame_tactic";
}

// ── Difficulty rating from cp_loss ───────────────────────────────────────────
function ratePuzzle(cpLoss: number): number {
  if (cpLoss >= 500) return 800;   // very clear, easy to spot
  if (cpLoss >= 300) return 1000;
  if (cpLoss >= 200) return 1200;
  if (cpLoss >= 150) return 1400;
  return 1600;                      // subtle mistake → harder puzzle
}

// ── Extract move rows from a single game result ──────────────────────────────
function extractMoves(
  gameResult: any,
  filename: string,
  rows: any[],
  username: string,
  seen: Set<string>,
) {
  const moves: any[] = gameResult?.move_history ?? [];
  moves.forEach((m, idx) => {
    if (!m.fen || !m.best_move) return;

    const quality  = m.quality ?? "";
    const cpLoss   = m.cp_loss ?? 0;
    const evalBefore = m.eval_before ?? 0;

    // Only real errors: Blunders always, Mistakes only if cp_loss > 150
    const isBlunder = quality === "Blunder";
    const isMistake = quality === "Mistake" && cpLoss > 150;
    if (!isBlunder && !isMistake) return;

    // Skip positions where the game was already clearly decided (±500cp = ≈98% win)
    if (Math.abs(evalBefore) > 500) return;

    // Deduplicate by FEN (same position might appear in multiple games)
    if (seen.has(m.fen)) return;
    seen.add(m.fen);

    const puzzleId = `${filename.replace(/\.pgn$/, "")}_mv${idx}`;

    rows.push({
      puzzle_id:     puzzleId,
      username,
      fen:           m.fen,
      best_move:     m.best_move,
      theme:         deriveTheme(m),
      difficulty:    isBlunder ? 3 : 2,
      source:        "own_game",
      game_filename: filename,
      move_number:   m.move_num ?? idx,
      phase:         m.phase ?? "middlegame",
      puzzle_rating: ratePuzzle(cpLoss),
    });
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;

  const { data: jobs, error } = await supabaseAdmin
    .from("analysis_jobs")
    .select("filename, result")
    .eq("username", username)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!jobs?.length) return NextResponse.json({ generated: 0 });

  const rows: any[] = [];
  const seen = new Set<string>(); // deduplicate by FEN

  for (const job of jobs) {
    const result = job.result;
    if (!result) continue;

    // Individual WASM analysis: result has move_history at top level
    if (Array.isArray(result.move_history)) {
      extractMoves(result, job.filename, rows, username, seen);
      continue;
    }

    // Batch analysis: result has individual_games[]
    if (Array.isArray(result.individual_games)) {
      for (const game of result.individual_games) {
        extractMoves(game, game.filename ?? job.filename, rows, username, seen);
      }
    }
  }

  if (rows.length === 0) return NextResponse.json({ generated: 0 });

  // Wipe old puzzles and insert fresh ones
  await supabaseAdmin
    .from("puzzles")
    .delete()
    .eq("username", username)
    .eq("source", "own_game");

  const { error: insertErr } = await supabaseAdmin
    .from("puzzles")
    .upsert(rows, { onConflict: "puzzle_id" });

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  return NextResponse.json({ generated: rows.length });
}
