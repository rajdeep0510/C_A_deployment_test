import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CHESS_COM_HEADERS = { "User-Agent": "ChessAdvisor/1.0" };

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
    label:    `G${i + 1}`,
    accuracy: parseFloat(job.result?.game_accuracy || 0),
  }));

  return {
    report: {
      title: `Progress Report — ${username}`,
      period_summary: {
        games_analyzed:       n,
        overall_avg_accuracy: avgAcc.toFixed(1),
        current_momentum:     momentum,
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
        data:   [Math.round(phaseAvg.opening), Math.round(phaseAvg.middlegame), Math.round(phaseAvg.endgame)],
      },
      accuracy_over_time: {
        labels: accuracyTimeline.map((p) => p.label),
        data:   accuracyTimeline.map((p) => p.accuracy),
      },
      mistake_distribution: {
        labels: Object.keys(qualityCounts),
        data:   Object.values(qualityCounts),
      },
    },
    move_breakdown: qualityCounts,
    openings: {
      performance:     openingPerf,
      mistakes:        openingPerf.filter((o) => o.losses > o.wins).slice(0, 3),
      recommendations: openingPerf
        .filter((o) => o.losses > o.wins)
        .slice(0, 3)
        .map((o) => ({
          type:    "Study",
          message: `Study the ${o.opening_name} — ${o.losses} losses vs ${o.wins} wins`,
        })),
    },
    mistake_frequency: {
      blunders_per_game:     (blunders / n).toFixed(2),
      mistakes_per_game:     (mistakes / n).toFixed(2),
      inaccuracies_per_game: (inaccuracies / n).toFixed(2),
      errors_per_10_moves:   (((blunders + mistakes) / n) / 3).toFixed(2),
    },
  };
}

function buildBasicReport(username: string, games: any[]) {
  let wins = 0, losses = 0, draws = 0;
  const openingMap: Record<string, { wins: number; losses: number; draws: number }> = {};
  const whiteOpenings: string[] = [];
  const blackOpenings: string[] = [];

  for (const game of games) {
    const isWhite = game.white?.username?.toLowerCase() === username.toLowerCase();
    const result  = isWhite ? game.white?.result : game.black?.result;
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

  const total   = wins + losses + draws;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
  const momentum = winRate >= 55 ? "Improving" : winRate >= 40 ? "Stable" : "Needs Work";

  const strengths: string[]  = [];
  const weaknesses: string[] = [];
  if (winRate >= 55) strengths.push(`Strong win rate of ${winRate}% across recent games`);
  else weaknesses.push(`Win rate of ${winRate}% — focus on converting advantages`);

  const topOpenings = Object.entries(openingMap)
    .sort((a, b) => b[1].wins + b[1].losses + b[1].draws - (a[1].wins + a[1].losses + a[1].draws))
    .slice(0, 5);

  for (const [name, rec] of topOpenings) {
    const t  = rec.wins + rec.losses + rec.draws;
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
        games_analyzed:       total,
        overall_avg_accuracy: "N/A (run Batch Analysis for accuracy data)",
        current_momentum:     momentum,
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
      phase_radar:        { labels: ["Opening", "Middlegame", "Endgame"], data: [0, 0, 0] },
      accuracy_over_time: { labels: [], data: [] },
    },
    move_breakdown: {},
  };
}

function classifyGame(g: any): string {
  if (g.time_class) return g.time_class;
  const base = parseInt((g.time_control || "").split("+")[0], 10);
  if (isNaN(base) || base <= 0) return "unknown";
  if (base < 180) return "bullet";
  if (base < 600) return "blitz";
  if (base < 1800) return "rapid";
  return "daily";
}

function filterBatchByTc(br: any, tc: string): any {
  const all: any[] = br.individual_games || [];
  const hasTimeClassData = all.some((g) => g.time_class);
  const filtered = all.filter((g) => classifyGame(g) === tc);
  if (filtered.length === 0) {
    return { _tc_no_data: true, _tc_reason: hasTimeClassData ? "no_games" : "needs_rerun" };
  }

  const n      = filtered.length;
  const avgAcc = n > 0 ? filtered.reduce((s, g) => s + parseFloat(g.accuracy ?? 0), 0) / n : 0;

  const qd: Record<string, number> = {};
  const phaseAcc: Record<string, { sum: number; count: number }> = {
    opening: { sum: 0, count: 0 }, middlegame: { sum: 0, count: 0 }, endgame: { sum: 0, count: 0 },
  };
  for (const g of filtered) {
    for (const m of (g.move_history || [])) {
      if (m.quality) qd[m.quality] = (qd[m.quality] || 0) + 1;
      if (m.phase && m.phase in phaseAcc) {
        phaseAcc[m.phase].sum += m.accuracy ?? 0;
        phaseAcc[m.phase].count++;
      }
    }
  }
  const phasePerf: Record<string, number> = {};
  for (const [phase, { sum, count }] of Object.entries(phaseAcc)) {
    phasePerf[phase] = count > 0 ? Math.round((sum / count) * 100) / 100 : 0;
  }

  const openingAcc: Record<string, { games: number; wins: number; losses: number; draws: number; accSum: number }> = {};
  for (const g of filtered) {
    const name: string = g.opening || "Unknown";
    if (!openingAcc[name]) openingAcc[name] = { games: 0, wins: 0, losses: 0, draws: 0, accSum: 0 };
    openingAcc[name].games++;
    if (g.user_result === "win") openingAcc[name].wins++;
    else if (g.user_result === "loss") openingAcc[name].losses++;
    else openingAcc[name].draws++;
    openingAcc[name].accSum += parseFloat(g.accuracy ?? 0);
  }
  const byOpening = Object.entries(openingAcc)
    .map(([opening, s]) => ({
      opening,
      games_played: s.games,
      wins: s.wins, losses: s.losses, draws: s.draws,
      win_rate:     s.games > 0 ? Math.round((s.wins / s.games) * 1000) / 10 : 0,
      avg_accuracy: s.games > 0 ? Math.round((s.accSum / s.games) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.games_played - a.games_played)
    .slice(0, 10);

  return {
    ...br,
    total_analyzed:           n,
    average_accuracy:         Math.round(avgAcc * 100) / 100,
    move_quality_distribution: qd,
    phase_performance:        phasePerf,
    individual_games:         filtered,
    openings: { ...br.openings, performance: { by_opening: byOpening } },
  };
}

function buildReportFromBatch(username: string, br: any) {
  const n      = br.total_analyzed || 0;
  const avgAcc: number = br.average_accuracy || 0;
  const qd: Record<string, number> = br.move_quality_distribution || {};
  const phasePerf: Record<string, number> = br.phase_performance || {};

  const strengths: string[]  = [];
  const weaknesses: string[] = [];
  for (const [phase, acc] of Object.entries(phasePerf)) {
    const v = acc as number;
    if (v >= 75) strengths.push(`Strong ${phase} play (${v.toFixed(1)}% accuracy)`);
    else if (v > 0 && v < 60) weaknesses.push(`${phase.charAt(0).toUpperCase() + phase.slice(1)} accuracy needs work (${v.toFixed(1)}%)`);
  }
  const blunders    = qd.Blunder || 0;
  const mistakes    = qd.Mistake || 0;
  const inaccuracies = qd.Inaccuracy || 0;
  if (n > 0 && blunders / n > 1) weaknesses.push(`High blunder rate (${(blunders / n).toFixed(1)} per game)`);
  if ((qd.Best || 0) > blunders * 3) strengths.push("Finding strong moves consistently");
  if (!strengths.length) strengths.push(`Average accuracy of ${avgAcc.toFixed(1)}% across ${n} analyzed games`);
  if (!weaknesses.length) weaknesses.push("Keep analyzing to find specific improvement areas");

  const momentum  = avgAcc >= 70 ? "Improving" : avgAcc >= 55 ? "Stable" : "Needs Work";
  const worstPhase = Object.entries(phasePerf)
    .filter(([, v]) => (v as number) > 0)
    .sort((a, b) => (a[1] as number) - (b[1] as number))[0]?.[0] ?? "endgame";

  const games: any[] = br.individual_games || [];
  const chronological = [...games].reverse();
  const accuracyTimeline = chronological.map((g: any, i: number) => {
    let date: string | undefined;
    const raw = String(g.date || "");
    if (raw && !raw.includes("?")) {
      const parts = raw.split(".");
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        if (!isNaN(d.getTime())) {
          date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        }
      }
    }
    return {
      label:    `G${i + 1}`,
      accuracy: Math.round(parseFloat(g.accuracy ?? 0) * 10) / 10,
      opening:  g.opening || undefined,
      date,
    };
  });

  const rep = br.openings?.repertoire || {};
  const extractNames = (arr: any[]) =>
    (arr || []).slice(0, 3).map((o: any) =>
      typeof o === "string" ? o : (o.name || o.opening_name || o.opening || "?")
    );
  const whiteOpenings = extractNames(rep.white_openings || rep.as_white || []);
  const blackOpenings = extractNames(rep.black_openings || rep.as_black || []);

  const bta = br.time_analysis;
  const mappedTimeAnalysis = bta && bta.games_with_time_data > 0
    ? {
        average_time_per_move: bta.phase_avg_time
          ? Object.values(bta.phase_avg_time as Record<string, number>)
              .filter((v) => v != null)
              .reduce((sum, v, _, arr) => sum + v / arr.length, 0)
          : null,
        phase_time_breakdown:            bta.phase_avg_time ?? null,
        time_pressure_risk:              (bta.time_pressure_pct ?? 0) > 40,
        think_move_count:                null,
        games_with_time_data:            bta.games_with_time_data,
        games_with_time_pressure:        bta.games_with_time_pressure,
        time_pressure_pct:               bta.time_pressure_pct,
        avg_time_pressure_moves_per_game: bta.avg_time_pressure_moves_per_game,
      }
    : null;

  const totalMoves = Object.values(qd).reduce((s, v) => s + v, 0);

  return {
    report: {
      title: `Progress Report — ${username}`,
      period_summary: {
        games_analyzed:       n,
        overall_avg_accuracy: avgAcc.toFixed(1),
        current_momentum:     momentum,
      },
      strengths_weaknesses: { strengths, weaknesses },
      repertoire_snapshot: { user_as_white: whiteOpenings, user_as_black: blackOpenings },
      top_action_items: [
        n > 0 && blunders / n > 1
          ? "Reduce blunders — pause before each move to check for tactics"
          : "Maintain tactical accuracy",
        `Study ${worstPhase} — your lowest-accuracy phase`,
        "Review your worst blunders from this batch for quick improvement",
      ],
    },
    visuals: {
      phase_radar: {
        labels: ["Opening", "Middlegame", "Endgame"],
        data:   [
          Math.round(phasePerf.opening || 0),
          Math.round(phasePerf.middlegame || 0),
          Math.round(phasePerf.endgame || 0),
        ],
      },
      accuracy_over_time: {
        labels:   accuracyTimeline.map((p) => p.label),
        data:     accuracyTimeline.map((p) => p.accuracy),
        openings: accuracyTimeline.map((p) => p.opening),
        dates:    accuracyTimeline.map((p) => p.date),
      },
      mistake_distribution: {
        labels: Object.keys(qd),
        data:   Object.values(qd),
      },
    },
    move_breakdown: qd,
    openings: br.openings
      ? (() => {
          const wldMap: Record<string, { wins: number; losses: number; draws: number }> = {};
          for (const g of (br.individual_games || [])) {
            const name: string = g.opening || "Unknown";
            if (!wldMap[name]) wldMap[name] = { wins: 0, losses: 0, draws: 0 };
            if (g.user_result === "win")       wldMap[name].wins++;
            else if (g.user_result === "loss") wldMap[name].losses++;
            else                               wldMap[name].draws++;
          }
          const mistakeMap: Record<string, number> = {};
          for (const o of (br.openings.mistakes?.worst_openings || [])) {
            mistakeMap[o.opening] = o.error_rate;
          }
          const perfRows = (br.openings.performance?.by_opening ?? []).map((o: any) => ({
            ...o,
            wins:         wldMap[o.opening]?.wins   ?? o.wins   ?? 0,
            losses:       wldMap[o.opening]?.losses ?? o.losses ?? 0,
            draws:        wldMap[o.opening]?.draws  ?? o.draws  ?? 0,
            mistake_rate: mistakeMap[o.opening]     ?? o.mistake_rate ?? null,
          }));
          return {
            performance:     perfRows,
            mistakes:        br.openings.mistakes,
            recommendations: br.openings.recommendations,
            repertoire:      br.openings.repertoire,
          };
        })()
      : undefined,
    patterns:         br.patterns,
    time_analysis:    mappedTimeAnalysis,
    mistake_frequency: n > 0
      ? {
          blunders_per_game:     (blunders / n).toFixed(2),
          mistakes_per_game:     (mistakes / n).toFixed(2),
          inaccuracies_per_game: (inaccuracies / n).toFixed(2),
          errors_per_10_moves:   totalMoves > 0
            ? (((blunders + mistakes) / totalMoves) * 10).toFixed(2)
            : "0.00",
        }
      : null,
  };
}

function applyIndividualAccuracies(
  br: any,
  byFilename: Map<string, number>,
  byGameKey:  Map<string, number>,
): any {
  if (byFilename.size === 0 && byGameKey.size === 0) return br;

  const games: any[] = br.individual_games || [];
  let anyPatched = false;
  const updatedGames = games.map((g: any) => {
    if (g.filename) {
      const acc = byFilename.get(g.filename);
      if (acc != null) { anyPatched = true; return { ...g, accuracy: acc }; }
    }
    const gameKey = [g.white, g.black, g.result]
      .map((v: any) => (v ?? "").toLowerCase())
      .join("|");
    if (gameKey.replace(/\|/g, "")) {
      const acc = byGameKey.get(gameKey);
      if (acc != null) { anyPatched = true; return { ...g, accuracy: acc }; }
    }
    return g;
  });

  if (!anyPatched) return br;

  const accs = updatedGames
    .map((g: any) => parseFloat(g.accuracy ?? 0))
    .filter((a: number) => a > 0);
  const newAvg =
    accs.length > 0
      ? accs.reduce((s: number, a: number) => s + a, 0) / accs.length
      : br.average_accuracy;

  let patchedOpenings = br.openings;
  if (br.openings?.performance) {
    const openingAcc: Record<string, {
      games: number; wins: number; losses: number; draws: number; accSum: number;
    }> = {};
    for (const g of updatedGames) {
      const name: string = g.opening || "Unknown";
      if (!openingAcc[name]) openingAcc[name] = { games: 0, wins: 0, losses: 0, draws: 0, accSum: 0 };
      openingAcc[name].games++;
      if (g.user_result === "win")       openingAcc[name].wins++;
      else if (g.user_result === "loss") openingAcc[name].losses++;
      else                               openingAcc[name].draws++;
      openingAcc[name].accSum += parseFloat(g.accuracy ?? 0);
    }
    const byOpening = Object.entries(openingAcc)
      .map(([opening, s]) => ({
        opening,
        games_played: s.games,
        wins:         s.wins,
        losses:       s.losses,
        draws:        s.draws,
        win_rate:     s.games > 0 ? Math.round((s.wins / s.games) * 1000) / 10 : 0,
        avg_accuracy: s.games > 0 ? Math.round((s.accSum / s.games) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.games_played - a.games_played)
      .slice(0, 10);
    patchedOpenings = {
      ...br.openings,
      performance: { ...br.openings.performance, by_opening: byOpening },
    };
  }

  return {
    ...br,
    individual_games: updatedGames,
    average_accuracy: Math.round(newAvg * 100) / 100,
    openings:         patchedOpenings,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  try {
    const tc = searchParams.get("tc");

    const indJobs = await prisma.analysis_jobs.findMany({
      where:   { username, status: "completed" },
      orderBy: { created_at: "desc" },
      take:    limit,
    });

    const byFilename = new Map<string, number>();
    const byGameKey  = new Map<string, number>();
    for (const j of indJobs) {
      const r   = j.result as any;
      const acc = r?.game_accuracy;
      if (acc == null) continue;
      const parsed = parseFloat(acc);
      if (j.filename) byFilename.set(j.filename, parsed);
      const key = [r?.white_player, r?.black_player, r?.result]
        .map((v: any) => (v ?? "").toLowerCase())
        .join("|");
      if (key.replace(/\|/g, "")) byGameKey.set(key, parsed);
    }

    if (tc && tc !== "all") {
      const tcJob = await prisma.batch_jobs.findFirst({
        where:   { username, status: "completed", time_class: tc },
        select:  { result: true, created_at: true },
        orderBy: { created_at: "desc" },
      });

      if (tcJob?.result) {
        const merged = applyIndividualAccuracies(tcJob.result, byFilename, byGameKey);
        return NextResponse.json(buildReportFromBatch(username, merged));
      }
    }

    const batchJob = await prisma.batch_jobs.findFirst({
      where:   { username, status: "completed", time_class: null },
      select:  { result: true, created_at: true },
      orderBy: { created_at: "desc" },
    });

    if (batchJob?.result) {
      const merged = applyIndividualAccuracies(batchJob.result, byFilename, byGameKey);
      if (tc && tc !== "all") {
        const filterResult = filterBatchByTc(merged, tc);
        if (filterResult._tc_no_data) {
          return NextResponse.json({ tc_no_data: true, tc, tc_reason: filterResult._tc_reason });
        }
        return NextResponse.json(buildReportFromBatch(username, filterResult));
      }
      return NextResponse.json(buildReportFromBatch(username, merged));
    }

    if (indJobs.length > 0) {
      const report = buildReportFromJobs(username, indJobs);
      if (report) return NextResponse.json(report);
    }

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
