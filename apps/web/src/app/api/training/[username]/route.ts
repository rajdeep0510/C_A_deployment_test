import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ERROR_QUALITIES = new Set(["Blunder", "Mistake", "Inaccuracy"]);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;

  try {
    const batchJob = await prisma.batch_jobs.findFirst({
      where:   { username, status: "completed", time_class: null },
      select:  { result: true, created_at: true },
      orderBy: { created_at: "desc" },
    });

    if (!batchJob?.result) {
      return NextResponse.json(
        { error: "No batch analysis found. Run Batch Analysis first." },
        { status: 404 },
      );
    }

    const br = batchJob.result as any;
    const rawGames: any[] = br.individual_games || [];

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

    const games: any[] = [];
    let anyFen         = false;
    let anyFullHistory = false;

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
      has_boards:   anyFen || anyFullHistory,
      summary,
      games,
    });
  } catch (err) {
    console.error("Training route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
