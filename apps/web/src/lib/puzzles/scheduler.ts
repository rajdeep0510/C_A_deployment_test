export interface SM2State {
  interval_days: number;
  ease_factor: number;
  next_review: Date;
  attempts: number;
  last_solved: Date | null;
}

export function createInitialSM2State(): SM2State {
  return {
    interval_days: 1,
    ease_factor: 2.5,
    next_review: new Date(),
    attempts: 0,
    last_solved: null,
  };
}

export function updateSM2(
  state: SM2State,
  solved: boolean,
  timeTakenSeconds?: number,
  puzzleRating?: number,
  playerRating?: number
): SM2State {
  const quality = qualityScore(solved, timeTakenSeconds, puzzleRating, playerRating);

  const newAttempts = state.attempts + 1;
  const newLastSolved = solved ? new Date() : state.last_solved;

  let newInterval = 1;
  let newEase = state.ease_factor;

  if (quality >= 3) {
    if (state.last_solved === null) {
      newInterval = 1;
    } else if (state.interval_days === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.max(1, Math.round(state.interval_days * state.ease_factor));
    }
    newEase = Math.max(1.3, state.ease_factor + 0.1 - (5 - quality) * 0.08);
  } else {
    newInterval = 1;
    newEase = Math.max(1.3, state.ease_factor - 0.2);
  }

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + newInterval);

  return {
    interval_days: newInterval,
    ease_factor: Number(newEase.toFixed(4)),
    next_review: nextReview,
    attempts: newAttempts,
    last_solved: newLastSolved,
  };
}

function qualityScore(
  solved: boolean,
  timeTakenSeconds?: number,
  puzzleRating?: number,
  playerRating?: number
): number {
  if (!solved) return 1;

  const t = timeTakenSeconds ?? 45.0;

  if (puzzleRating !== undefined && playerRating !== undefined) {
    const gap = puzzleRating - playerRating;
    if (gap >= 300) return 5;
    if (gap >= 100) return t < 60 ? 5 : 4;
    if (gap >= -100) return t < 30 ? 5 : t < 90 ? 4 : 3;
    return t < 15 ? 5 : t < 45 ? 4 : 3;
  }

  if (t < 30) return 5;
  if (t < 90) return 4;
  return 3;
}
