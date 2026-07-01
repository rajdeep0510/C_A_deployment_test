import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const CHESS_COM_HEADERS = { "User-Agent": "ChessAdvisor/1.0" };

// ---------------------------------------------------------------------------
// Chess.com game fetcher
// ---------------------------------------------------------------------------
async function fetchRecentChessComGames(username: string, limit: number) {
  try {
    const archivesRes = await fetch(
      `https://api.chess.com/pub/player/${username}/games/archives`,
      { headers: CHESS_COM_HEADERS }
    );
    if (!archivesRes.ok) return [];
    const { archives } = await archivesRes.json();
    if (!archives?.length) return [];

    const games: any[] = [];
    for (const archiveUrl of [...archives].reverse()) {
      if (games.length >= limit) break;
      const res = await fetch(archiveUrl, { headers: CHESS_COM_HEADERS });
      if (!res.ok) continue;
      const { games: ag } = await res.json();
      games.push(...[...ag].reverse().slice(0, limit - games.length));
    }
    return games;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Build report from completed analysis_jobs (Python worker / WASM results)
// ---------------------------------------------------------------------------
function buildReportFromJobs(username: string, jobs: any[]) {
  const completed = jobs.filter((j) => j.status === "completed" && j.result);
  if (completed.length === 0) return null;

  let totalAcc = 0;
  const phaseAcc: Record<string, number[]> = { opening: [], middlegame: [], endgame: [] };
  const qualityCounts: Record<string, number> = {};
  const openingMap: Record<string, { wins: number; losses: number; draws: number; accs: number[] }> = {};

  for (const job of completed) {
    const r = job.result;
    if (r.game_accuracy) totalAcc += parseFloat(r.game_accuracy);

    for (const [phase, acc] of Object.entries(r.phase_accuracy ?? {})) {
      phaseAcc[phase]?.push(parseFloat(acc as string));
    }

    for (const move of r.move_history ?? []) {
      if (move.quality) qualityCounts[move.quality] = (qualityCounts[move.quality] || 0) + 1;
    }

    const opening = r.opening_name || "Unknown";
    if (!openingMap[opening]) openingMap[opening] = { wins: 0, losses: 0, draws: 0, accs: [] };
    if (r.game_accuracy) openingMap[opening].accs.push(parseFloat(r.game_accuracy));

    const res = r.result || "*";
    const userIsWhite = r.white_player?.toLowerCase() === username.toLowerCase();
    if (res === "1-0") { userIsWhite ? openingMap[opening].wins++ : openingMap[opening].losses++; }
    else if (res === "0-1") { userIsWhite ? openingMap[opening].losses++ : openingMap[opening].wins++; }
    else if (res !== "*") { openingMap[opening].draws++; }
  }

  const n = completed.length;
  const avgAcc = n > 0 ? totalAcc / n : 0;
  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const phaseAvg = { opening: avg(phaseAcc.opening), middlegame: avg(phaseAcc.middlegame), endgame: avg(phaseAcc.endgame) };

  const blunders = qualityCounts["Blunder"] || 0;
  const mistakes = qualityCounts["Mistake"] || 0;
  const inaccuracies = qualityCounts["Inaccuracy"] || 0;

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  for (const [phase, acc] of Object.entries(phaseAvg)) {
    if (acc >= 75) strengths.push(`Strong ${phase} play (${acc.toFixed(1)}% accuracy)`);
    else if (acc > 0 && acc < 60) weaknesses.push(`${phase.charAt(0).toUpperCase() + phase.slice(1)} accuracy needs work (${acc.toFixed(1)}%)`);
  }
  if (blunders / n > 1) weaknesses.push(`High blunder rate (${(blunders / n).toFixed(1)} per game)`);
  if ((qualityCounts["Best"] || 0) > blunders * 3) strengths.push("Finding strong moves consistently");
  if (!strengths.length) strengths.push(`Average accuracy of ${avgAcc.toFixed(1)}% across ${n} analyzed games`);
  if (!weaknesses.length) weaknesses.push("Keep analyzing to find specific improvement areas");

  const openingPerf = Object.entries(openingMap).map(([name, d]) => ({
    opening_name: name,
    wins: d.wins, losses: d.losses, draws: d.draws,
    avg_accuracy: d.accs.length ? (d.accs.reduce((a, b) => a + b, 0) / d.accs.length).toFixed(1) : null,
  }));

  const worstPhase = Object.entries(phaseAvg).filter(([, v]) => v > 0).sort((a, b) => a[1] - b[1])[0]?.[0] ?? "endgame";
  const momentum = avgAcc >= 70 ? "Improving" : avgAcc >= 55 ? "Stable" : "Needs Work";

  const accuracyTimeline = [...completed].reverse().map((job, i) => ({
    label: `G${i + 1}`,
    accuracy: parseFloat(job.result?.game_accuracy || 0),
  }));

  return {
    report: {
      title: `Progress Report — ${username}`,
      period_summary: {
        games_analyzed: n,
        overall_avg_accuracy: avgAcc.toFixed(1),
        current_momentum: momentum,
      },
      strengths_weaknesses: { strengths, weaknesses },
      repertoire_snapshot: {
        user_as_white: openingPerf.slice(0, 3).map((o) => o.opening_name),
        user_as_black: [],
      },
      top_action_items: [
        blunders / n > 1 ? "Reduce blunders — pause before each move to check for tactics" : "Maintain tactical accuracy",
        `Study ${worstPhase} — your lowest-accuracy phase`,
        "Review your worst game from this batch for quick improvement",
      ],
    },
    visuals: {
      phase_radar: {
        labels: ["Opening", "Middlegame", "Endgame"],
        data: [Math.round(phaseAvg.opening), Math.round(phaseAvg.middlegame), Math.round(phaseAvg.endgame)],
      },
      accuracy_over_time: {
        labels: accuracyTimeline.map((p) => p.label),
        data: accuracyTimeline.map((p) => p.accuracy),
      },
      mistake_distribution: {
        labels: Object.keys(qualityCounts),
        data: Object.values(qualityCounts),
      },
    },
    move_breakdown: qualityCounts,
    openings: {
      performance: openingPerf,
      mistakes: openingPerf.filter((o) => o.losses > o.wins).slice(0, 3),
      recommendations: openingPerf
        .filter((o) => o.losses > o.wins)
        .slice(0, 3)
        .map((o) => ({
          type: "Study",
          message: `Study the ${o.opening_name} — ${o.losses} losses vs ${o.wins} wins`,
        })),
    },
    mistake_frequency: {
      blunders_per_game: (blunders / n).toFixed(2),
      mistakes_per_game: (mistakes / n).toFixed(2),
      inaccuracies_per_game: (inaccuracies / n).toFixed(2),
      errors_per_10_moves: (((blunders + mistakes) / n) / 3).toFixed(2),
    },
  };
}

// ---------------------------------------------------------------------------
// Build a lightweight report from raw Chess.com games (no analysis needed)
// ---------------------------------------------------------------------------
function buildBasicReport(username: string, games: any[]) {
  let wins = 0, losses = 0, draws = 0;
  const openingMap: Record<string, { wins: number; losses: number; draws: number }> = {};
  const whiteOpenings: string[] = [];
  const blackOpenings: string[] = [];

  for (const game of games) {
    const isWhite = game.white?.username?.toLowerCase() === username.toLowerCase();
    const result = isWhite ? game.white?.result : game.black?.result;
    // Chess.com API has eco_url (e.g. ".../Sicilian-Defense") not an opening field
    const ecoUrl: string = game.eco_url || "";
    const opening = ecoUrl
      ? decodeURIComponent(ecoUrl.split("/").pop() || "").replace(/-/g, " ")
      : (game.eco || "Unknown Opening");

    if (!openingMap[opening]) openingMap[opening] = { wins: 0, losses: 0, draws: 0 };

    if (result === "win") {
      wins++;
      openingMap[opening].wins++;
      if (isWhite && !whiteOpenings.includes(opening)) whiteOpenings.push(opening);
      if (!isWhite && !blackOpenings.includes(opening)) blackOpenings.push(opening);
    } else if (["checkmated", "resigned", "timeout", "abandoned"].includes(result)) {
      losses++;
      openingMap[opening].losses++;
    } else {
      draws++;
      openingMap[opening].draws++;
    }
  }

  const total = wins + losses + draws;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
  const momentum = winRate >= 55 ? "Improving" : winRate >= 40 ? "Stable" : "Needs Work";

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  if (winRate >= 55) strengths.push(`Strong win rate of ${winRate}% across recent games`);
  else weaknesses.push(`Win rate of ${winRate}% — focus on converting advantages`);

  const topOpenings = Object.entries(openingMap)
    .sort((a, b) => b[1].wins + b[1].losses + b[1].draws - (a[1].wins + a[1].losses + a[1].draws))
    .slice(0, 5);

  for (const [name, rec] of topOpenings) {
    const t = rec.wins + rec.losses + rec.draws;
    const wr = t > 0 ? Math.round((rec.wins / t) * 100) : 0;
    if (wr >= 60 && t >= 2) strengths.push(`Performing well in ${name} (${wr}% win rate)`);
    else if (wr <= 30 && t >= 2) weaknesses.push(`Struggling in ${name} (${wr}% win rate)`);
  }

  if (!strengths.length) strengths.push("Active player with consistent game history");
  if (!weaknesses.length) weaknesses.push("Run batch analysis for detailed improvement insights");

  return {
    report: {
      title: `Progress Report — ${username}`,
      period_summary: {
        games_analyzed: total,
        overall_avg_accuracy: "N/A (run Batch Analysis for accuracy data)",
        current_momentum: momentum,
      },
      strengths_weaknesses: { strengths, weaknesses },
      repertoire_snapshot: {
        user_as_white: whiteOpenings.slice(0, 3),
        user_as_black: blackOpenings.slice(0, 3),
      },
      top_action_items: [
        "Run Batch Analysis to get detailed per-game accuracy metrics",
        "Review your opening repertoire for consistency",
        weaknesses[0] || "Analyze your most recent losses to find patterns",
      ],
    },
    visuals: {
      phase_radar: { labels: ["Opening", "Middlegame", "Endgame"], data: [0, 0, 0] },
      accuracy_over_time: { labels: [], data: [] },
    },
    move_breakdown: {},
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  try {
    // 1. Try completed analysis jobs first
    const { data: jobs } = await supabaseAdmin
      .from("analysis_jobs")
      .select("*")
      .eq("username", username)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (jobs && jobs.length > 0) {
      const report = buildReportFromJobs(username, jobs);
      if (report) return NextResponse.json(report);
    }

    // 2. Fallback: basic report from Chess.com game history
    const games = await fetchRecentChessComGames(username, 20);
    if (games.length > 0) {
      return NextResponse.json(buildBasicReport(username, games));
    }

    return NextResponse.json({ error: "No data found" }, { status: 404 });
  } catch (err) {
    console.error("Report error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
