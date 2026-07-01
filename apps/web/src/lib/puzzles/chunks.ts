// Reads puzzles from the gzipped, rating-bucketed CSV chunks in
// apps/web/puzzle_data/.
//
// The 1.1GB lichess_db_puzzle.csv is split (by puzzle_algo/build_chunks.mjs) into
// gzipped CSV chunks grouped by 200-point rating buckets, e.g.:
//   rating_1000-1200.csv.gz          (single file)
//   rating_1200-1400_part1.csv.gz    (busy range -> multiple parts)
//   rating_1200-1400_part2.csv.gz
// Each chunk decompresses to a valid CSV with the original header + all columns.
//
// NOTE: gzip streams can't be byte-seeked, so the old "random byte offset" trick
// is impossible here. Instead we decompress and use RESERVOIR SAMPLING to pull a
// uniformly random set of matching rows per file. Parts are small (~24MB
// uncompressed) so a full gunzip pass is fast. Given a rating window we resolve
// the overlapping bucket(s) and read ALL of their parts as needed.

import fs from "fs";
import path from "path";
import zlib from "zlib";
import readline from "readline";

const CHUNK_DIR = path.join(process.cwd(), "puzzle_data");
const BUCKET_WIDTH = 200;
const FILE_RE = /^rating_(\d{4}-\d{4})(?:_part\d+)?\.csv\.gz$/;

export type PuzzleRow = {
  puzzle_id: string;
  fen: string;
  moves: string;
  theme: string;
  difficulty: number;
  rating: number;
};

const pad4 = (n: number) => String(n).padStart(4, "0");

// Directory listing is cached: the chunks are static, read-only reference data.
let fileCache: string[] | null = null;
function listChunkFiles(): string[] {
  if (fileCache === null) {
    try {
      fileCache = fs.readdirSync(CHUNK_DIR).filter((f) => FILE_RE.test(f));
    } catch {
      fileCache = [];
    }
  }
  return fileCache;
}

function bucketKeysInRange(ratingMin: number, ratingMax: number): Set<string> {
  const lo = Math.floor(ratingMin / BUCKET_WIDTH) * BUCKET_WIDTH;
  const hi = Math.floor(ratingMax / BUCKET_WIDTH) * BUCKET_WIDTH;
  const keys = new Set<string>();
  for (let l = lo; l <= hi; l += BUCKET_WIDTH) {
    keys.add(`${pad4(l)}-${pad4(l + BUCKET_WIDTH)}`);
  }
  return keys;
}

// All chunk files (including every _partN) whose bucket overlaps [min, max].
export function filesForRange(ratingMin: number, ratingMax: number): string[] {
  const keys = bucketKeysInRange(ratingMin, ratingMax);
  return listChunkFiles().filter((f) => {
    const m = f.match(FILE_RE);
    return m ? keys.has(m[1]) : false;
  });
}

// Group the overlapping files by bucket key (so each bucket can be sampled once).
function filesByBucket(ratingMin: number, ratingMax: number): Map<string, string[]> {
  const keys = bucketKeysInRange(ratingMin, ratingMax);
  const out = new Map<string, string[]>();
  for (const f of listChunkFiles()) {
    const m = f.match(FILE_RE);
    if (m && keys.has(m[1])) {
      const arr = out.get(m[1]) ?? [];
      arr.push(f);
      out.set(m[1], arr);
    }
  }
  return out;
}

export function phaseOf(theme: string): string {
  if (theme.includes("endgame")) return "endgame";
  if (theme.includes("opening")) return "opening";
  return "middlegame";
}

function parseLine(line: string): PuzzleRow | null {
  // FEN/Moves/Themes/GameUrl contain no commas, so a plain split is safe.
  // The header row parses to rating=NaN and is dropped here automatically.
  const parts = line.split(",");
  if (parts.length < 9) return null;
  const rating = parseInt(parts[3], 10);
  if (Number.isNaN(rating)) return null;
  return {
    puzzle_id: parts[0],
    fen: parts[1],
    moves: parts[2],
    theme: parts[7],
    difficulty: rating,
    rating,
  };
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Decompress a chunk and return up to `k` uniformly random rows passing `accept`
// (reservoir sampling — single pass, O(k) memory, varied results each call).
async function reservoirSample(
  file: string,
  k: number,
  accept: (row: PuzzleRow) => boolean,
): Promise<PuzzleRow[]> {
  if (k <= 0) return [];
  const full = path.join(CHUNK_DIR, file);
  const stream = fs.createReadStream(full).pipe(zlib.createGunzip());
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  const res: PuzzleRow[] = [];
  let seen = 0;
  for await (const line of rl) {
    const row = parseLine(line);
    if (!row || !accept(row)) continue;
    if (res.length < k) {
      res.push(row);
    } else {
      const j = Math.floor(Math.random() * (seen + 1));
      if (j < k) res[j] = row;
    }
    seen++;
  }
  rl.close();
  return res;
}

// Decompress a chunk and return the first `k` rows passing `accept`, stopping as
// soon as we have them (fast — used for the ladder where per-bucket variety comes
// from picking a random part, not from scanning the whole file).
async function readMatches(
  file: string,
  k: number,
  accept: (row: PuzzleRow) => boolean,
): Promise<PuzzleRow[]> {
  if (k <= 0) return [];
  const full = path.join(CHUNK_DIR, file);
  const stream = fs.createReadStream(full).pipe(zlib.createGunzip());
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  const out: PuzzleRow[] = [];
  for await (const line of rl) {
    const row = parseLine(line);
    if (row && accept(row)) {
      out.push(row);
      if (out.length >= k) break;
    }
  }
  rl.close();
  stream.destroy();
  return out;
}

// Downsample an ascending-sorted list to `count` items while preserving the full
// spread from first to last (used to keep the ladder spanning easy -> hard).
function evenSample<T>(sortedAsc: T[], count: number): T[] {
  if (sortedAsc.length <= count) return sortedAsc;
  const out: T[] = [];
  for (let i = 0; i < count; i++) {
    out.push(sortedAsc[Math.floor((i * sortedAsc.length) / count)]);
  }
  return out;
}

export type LoadOpts = {
  ratingMin: number;
  ratingMax: number;
  limit: number;
  theme?: string | null;
  phase?: string | null;
};

// Random sample within a rating window, filtered by optional theme/phase.
// Reads random parts of the overlapping buckets until `limit` is satisfied.
export async function loadRandomPuzzles(opts: LoadOpts): Promise<PuzzleRow[]> {
  const { ratingMin, ratingMax, limit, theme, phase } = opts;
  const files = shuffle(filesForRange(ratingMin, ratingMax));
  if (files.length === 0) return [];

  const accept = (row: PuzzleRow) =>
    row.rating >= ratingMin &&
    row.rating <= ratingMax &&
    (!theme || row.theme.includes(theme)) &&
    (!phase || phaseOf(row.theme) === phase);

  const target = limit * 5;
  const collected: PuzzleRow[] = [];
  for (const file of files) {
    if (collected.length >= target) break;
    collected.push(...(await reservoirSample(file, target - collected.length, accept)));
  }
  return shuffle(collected).slice(0, limit);
}

// Ladder pool: sample evenly from EVERY bucket across the span, then sort
// ascending (easy -> hard) to recreate the Python ladder mode's progressive
// difficulty. Even per-bucket sampling guarantees the ladder spans the whole
// range instead of bunching at the easy end.
export async function loadLadderPuzzles(
  count: number,
  ratingMin = 800,
  ratingMax = 2400,
): Promise<PuzzleRow[]> {
  const groups = filesByBucket(ratingMin, ratingMax);
  if (groups.size === 0) return [];

  const accept = (row: PuzzleRow) => row.rating >= ratingMin && row.rating <= ratingMax;
  // Pull a slice from each bucket (a little extra for headroom), spread evenly.
  const perBucket = Math.ceil(count / groups.size) + 2;

  const collected: PuzzleRow[] = [];
  for (const parts of groups.values()) {
    const file = parts[Math.floor(Math.random() * parts.length)]; // one random part per bucket
    collected.push(...(await readMatches(file, perBucket, accept)));
  }
  collected.sort((a, b) => a.rating - b.rating);
  return evenSample(collected, count);
}
