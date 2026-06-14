import { Game } from "@repo/types";

export function calculateWinRate(username: string, games: Game[]) {
  const stats: any = {
    username,
    total_games: games.length,
    overall_win_rate: 0,
    win_rate: {
      white: { wins: 0, losses: 0, draws: 0, total: 0 },
      black: { wins: 0, losses: 0, draws: 0, total: 0 },
    },
    // Adding these for compatibility with dashboard expectations
    white_stats: { total: 0, wins: 0, losses: 0, draws: 0 },
    black_stats: { total: 0, wins: 0, losses: 0, draws: 0 },
    time_control_performance: {},
    termination_reasons: {},
    momentum: "Stable", // Default placeholder
    accuracy: null
  };

  const userLower = username.toLowerCase();

  games.forEach(game => {
    const isWhite = game.white?.toLowerCase() === userLower;
    const isBlack = game.black?.toLowerCase() === userLower;
    if (!isWhite && !isBlack) return;

    const side = isWhite ? 'white' : 'black';
    stats.win_rate[side].total++;
    stats[`${side}_stats`].total++;

    let outcome: 'win' | 'loss' | 'draw' = 'draw';
    
    const result = game.result;
    // Normalize outcome based on common PGN/API results
    if (result === '1-0' || result === 'white') {
      outcome = isWhite ? 'win' : 'loss';
    } else if (result === '0-1' || result === 'black') {
      outcome = isBlack ? 'win' : 'loss';
    } else if (result === '1/2-1/2' || result === 'draw') {
      outcome = 'draw';
    } else if (result === 'win') {
      outcome = 'win';
    } else if (result === 'loss' || result === 'checkmated' || result === 'resigned' || result === 'timeout') {
      outcome = 'loss';
    }

    if (outcome === 'win') {
      stats.win_rate[side].wins++;
      stats[`${side}_stats`].wins++;
    } else if (outcome === 'loss') {
      stats.win_rate[side].losses++;
      stats[`${side}_stats`].losses++;
    } else {
      stats.win_rate[side].draws++;
      stats[`${side}_stats`].draws++;
    }
  });

  const calcPct = (count: number, total: number) => total > 0 ? Math.round((count / total) * 100) : 0;

  const totalWins = stats.win_rate.white.wins + stats.win_rate.black.wins;
  stats.overall_win_rate = calcPct(totalWins, stats.total_games);

  return stats;
}
