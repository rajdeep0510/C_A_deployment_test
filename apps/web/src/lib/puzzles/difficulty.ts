const BASE_OFFSET = 100;
const STREAK_BOOST = 50;
const FAIL_EASE = -50;
const BAND_MARGIN = 100;

export function getTargetBand(
  playerRating: number,
  recentResults: boolean[],
  themeOffset: number = 0
): [number, number] {
  let offset = BASE_OFFSET;

  const tail = recentResults.slice(-5);

  if (tail.length >= 3 && tail.slice(-3).every(r => r === true)) {
    offset += STREAK_BOOST;
  }

  if (tail.length >= 2 && tail.slice(-2).every(r => r === false)) {
    offset += FAIL_EASE;
  }

  offset += themeOffset * 0.5;

  const centre = playerRating + offset;
  const lo = Math.max(400, Math.round(centre - BAND_MARGIN));
  const hi = Math.min(3000, Math.round(centre + BAND_MARGIN));

  return [lo, hi];
}

export function getCalibrationPuzzleRatings(): number[] {
  return [800, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1800, 2000];
}

export function estimatePuzzleRatingFromCpLoss(cpLoss: number): number {
  if (cpLoss < 200) {
    return Math.round(1000 + (cpLoss - 100) * 2);
  } else if (cpLoss < 400) {
    return Math.round(1200 + (cpLoss - 200) * 1.5);
  } else if (cpLoss < 700) {
    return Math.round(1500 + (cpLoss - 400) * 1.0);
  } else {
    return Math.min(2200, Math.round(1800 + (cpLoss - 700) * 0.5));
  }
}
