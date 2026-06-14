export interface GlickoRating {
  rating: number;
  rd: number;
  volatility: number;
}

const SCALE = 173.7178;
const TAU = 0.5;
const PUZZLE_RD = 30.0;
const EPSILON = 1e-6;

const MIN_RATING = 400;
const MAX_RATING = 3000;
const MIN_RD = 30.0;
const MAX_RD = 350.0;

export function updateGlicko(
  player: GlickoRating,
  puzzleRating: number,
  solved: boolean,
  puzzleRd: number = PUZZLE_RD
): GlickoRating {
  const score = solved ? 1.0 : 0.0;

  const [mu, phi] = toG2(player.rating, player.rd);
  const [muJ, phiJ] = toG2(puzzleRating, puzzleRd);
  const sigma = player.volatility;

  const gJ = g(phiJ);
  const eJ = e(mu, muJ, phiJ);

  const v = 1.0 / (gJ ** 2 * eJ * (1.0 - eJ));
  const delta = v * gJ * (score - eJ);

  const newSigma = newVolatility(phi, sigma, delta, v);
  const phiStar = Math.sqrt(phi ** 2 + newSigma ** 2);
  const newPhi = 1.0 / Math.sqrt(1.0 / phiStar ** 2 + 1.0 / v);
  const newMu = mu + newPhi ** 2 * gJ * (score - eJ);

  let [newR, newRD] = fromG2(newMu, newPhi);
  newR = Math.max(MIN_RATING, Math.min(MAX_RATING, newR));
  newRD = Math.max(MIN_RD, Math.min(MAX_RD, newRD));

  return {
    rating: Number(newR.toFixed(1)),
    rd: Number(newRD.toFixed(1)),
    volatility: Number(newSigma.toFixed(6)),
  };
}

function toG2(r: number, rd: number): [number, number] {
  return [(r - 1500.0) / SCALE, rd / SCALE];
}

function fromG2(mu: number, phi: number): [number, number] {
  return [SCALE * mu + 1500.0, SCALE * phi];
}

function g(phi: number): number {
  return 1.0 / Math.sqrt(1.0 + (3.0 * phi ** 2) / Math.PI ** 2);
}

function e(mu: number, muJ: number, phiJ: number): number {
  return 1.0 / (1.0 + Math.exp(-g(phiJ) * (mu - muJ)));
}

function newVolatility(phi: number, sigma: number, delta: number, v: number): number {
  const a = Math.log(sigma ** 2);

  function f(x: number): number {
    const ex = Math.exp(x);
    const d2 = phi ** 2 + v + ex;
    const num = ex * (delta ** 2 - phi ** 2 - v - ex);
    const den = 2.0 * d2 ** 2;
    return num / den - (x - a) / TAU ** 2;
  }

  let A = a;
  let fA = f(A);
  let B: number;

  if (delta ** 2 > phi ** 2 + v) {
    B = Math.log(delta ** 2 - phi ** 2 - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) {
      k += 1;
    }
    B = a - k * TAU;
  }
  let fB = f(B);

  for (let i = 0; i < 100; i++) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA /= 2.0;
    }
    B = C;
    fB = fC;
    if (Math.abs(B - A) < EPSILON) {
      break;
    }
  }

  return Math.exp(A / 2.0);
}
