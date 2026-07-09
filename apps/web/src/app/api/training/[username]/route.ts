import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ERROR_QUALITIES = new Set(["Blunder", "Mistake", "Inaccuracy"]);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;

  try {
    // Fetch latest completed all-games batch job
    const { data: batchJobs } = await supabaseAdmin
      .from("batch_jobs")
      .select("result, created_at")
      .eq("username", username)
      .eq("status", "completed")
      .is("time_class", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!batchJobs?.[0]?.result) {
      return NextResponse.json(
        { error: "No batch analysis found. Run Batch Analysis first." },
        { status: 404 },
      );
    }

    const br = batchJobs[0].result;
    const rawGames: any[] = br.individual_games || [];

    // Summary counters
    const summary: {
      blunders: number;
      mistakes: number;
      inaccuracies: number;
      by_nature: Record<string, number>;
      by_phase: Record<string, number>;
    } = {
      blunders: 0,
      mistakes: 0,
      inaccuracies: 0,
      by_nature: {},
      by_phase: {},
    };

    // Build per-game objects containing only error moves
    const games: any[] = [];
    let anyFen         = false;   // at least one move has fen_before
    let anyFullHistory = false;   // at least one game has full_history for client-side reconstruction

    for (const g of rawGames) {
      const errors: any[] = [];
      const fullHistory: any[] = g.full_history || [];
      if (fullHistory.length > 0) anyFullHistory = true;

      for (const m of (g.move_history || []) as any[]) {
        if (!ERROR_QUALITIES.has(m.quality)) continue;

        if (m.quality === "Blunder")       summary.blunders++;
        else if (m.quality === "Mistake")  summary.mistakes++;
        else                               summary.inaccuracies++;

        const nature = m.error_nature || "Unknown";
        const phase  = m.phase || "unknown";
        summary.by_nature[nature] = (summary.by_nature[nature] || 0) + 1;
        summary.by_phase[phase]   = (summary.by_phase[phase]   || 0) + 1;

        if (m.fen_before) anyFen = true;

        errors.push({
          quality:       m.quality,
          error_nature:  nature,
          phase,
          move_number:   m.move_number,
          san:           m.san,
          best_move:     m.best_move,
          cp_loss:       m.cp_loss,
          eval_before:   m.eval_before,
          eval_after:    m.eval_after,
          win_prob_drop: m.win_prob_drop,
          fen_before:    m.fen_before ?? null,
        });
      }

      if (errors.length === 0) continue;

      const color    = g.user_color || "white";
      const opponent = color === "white" ? g.black : g.white;

      games.push({
        filename:     g.filename,
        opening:      g.opening || "Unknown Opening",
        result:       g.user_result || "?",
        date:         g.date || null,
        opponent:     opponent || "?",
        user_color:   color,
        full_history: fullHistory,
        errors,
      });
    }

    const totalErrors = summary.blunders + summary.mistakes + summary.inaccuracies;

    return NextResponse.json({
      total_games:  rawGames.length,
      total_errors: totalErrors,
      // boards are renderable when fen_before (direct) OR full_history (client reconstruction) is available
      has_boards: anyFen || anyFullHistory,
      summary,
      games,
    });
  } catch (err) {
    console.error("Training route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
