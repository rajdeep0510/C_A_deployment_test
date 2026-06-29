// build_chunks.mjs
// One-time local preprocessor.
// Streams the 1.1GB lichess_db_puzzle.csv and splits it into rating-bucketed,
// GZIPPED CSV chunks under apps/web/puzzle_data/. Every chunk decompresses to a
// valid CSV with the ORIGINAL header + ALL original columns (drop-in format).
//
//   rating_1000-1200.csv.gz         (single file)
//   rating_1200-1400_part1.csv.gz   (busy range -> multiple parts)
//   rating_1200-1400_part2.csv.gz
//
// Buckets are 200 rating points wide (aligned with the elo +/-200 filter logic).
// Parts are capped by UNCOMPRESSED size so each one decompresses quickly at read
// time. Gzip shrinks the on-disk total ~4x (1.05GB -> ~300MB).
//
// Run from this folder:  node build_chunks.mjs

import fs from "fs";
import path from "path";
import zlib from "zlib";
import readline from "readline";
import { once } from "events";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CSV_PATH = path.join(__dirname, "lichess_db_puzzle.csv", "lichess_db_puzzle.csv");
const OUT_DIR = path.join(__dirname, "..", "puzzle_data");

const BUCKET_WIDTH = 200;                  // rating points per bucket
const MAX_BYTES = 24 * 1024 * 1024;        // ~24MB UNCOMPRESSED per part -> fast gunzip at read time

const pad4 = (n) => String(n).padStart(4, "0");

function bucketKey(rating) {
  const lower = Math.floor(rating / BUCKET_WIDTH) * BUCKET_WIDTH;
  return `${pad4(lower)}-${pad4(lower + BUCKET_WIDTH)}`;
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`Could not find CSV at:\n  ${CSV_PATH}`);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Clean any previous chunk output (plain or gzipped) so we don't mix formats.
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.startsWith("rating_") && (f.endsWith(".csv") || f.endsWith(".csv.gz"))) {
      fs.rmSync(path.join(OUT_DIR, f));
    }
  }

  const fileStream = fs.createReadStream(CSV_PATH, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  // bucketKey -> { gz, out, bytes, part }
  const buckets = new Map();
  const partCount = new Map();

  let header = null;
  let total = 0, kept = 0, skipped = 0;
  const startedAt = Date.now();
  const headerBytes = () => Buffer.byteLength(header + "\n", "utf-8");

  function gzName(key, part) {
    return path.join(OUT_DIR, `rating_${key}_part${part}.csv.gz`);
  }

  function openPart(key, part) {
    const out = fs.createWriteStream(gzName(key, part));
    const gz = zlib.createGzip();
    gz.pipe(out);
    gz.write(header + "\n");
    return { gz, out, bytes: headerBytes(), part };
  }

  async function closePart(b) {
    b.gz.end();
    await once(b.out, "finish");
  }

  async function writeLine(key, line) {
    let b = buckets.get(key);
    const payload = line + "\n";
    const size = Buffer.byteLength(payload, "utf-8");

    if (!b) {
      b = openPart(key, 1);
      buckets.set(key, b);
      partCount.set(key, 1);
    }

    if (b.bytes + size > MAX_BYTES) {
      await closePart(b);
      const next = openPart(key, b.part + 1);
      buckets.set(key, next);
      partCount.set(key, next.part);
      b = next;
    }

    b.bytes += size;
    if (!b.gz.write(payload)) {
      await once(b.gz, "drain");
    }
  }

  for await (const line of rl) {
    if (header === null) {
      header = line;
      continue;
    }
    if (line.length === 0) continue;
    total++;

    const parts = line.split(",");
    if (parts.length < 9) { skipped++; continue; }
    const rating = parseInt(parts[3], 10);
    if (Number.isNaN(rating)) { skipped++; continue; }

    await writeLine(bucketKey(rating), line);
    kept++;

    if (total % 500000 === 0) {
      const secs = ((Date.now() - startedAt) / 1000).toFixed(0);
      console.log(`  processed ${total.toLocaleString()} rows (${secs}s)...`);
    }
  }

  for (const b of buckets.values()) {
    await closePart(b);
  }

  // Single-part buckets: drop the _part1 suffix for clean names.
  for (const [key, count] of partCount.entries()) {
    if (count === 1) {
      fs.renameSync(gzName(key, 1), path.join(OUT_DIR, `rating_${key}.csv.gz`));
    }
  }

  const files = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith(".csv.gz")).sort();
  let totalBytes = 0;
  console.log("\n=== Chunks written (gzipped) ===");
  for (const f of files) {
    const sz = fs.statSync(path.join(OUT_DIR, f)).size;
    totalBytes += sz;
    console.log(`  ${f.padEnd(34)} ${(sz / 1024 / 1024).toFixed(1)} MB`);
  }
  console.log("================================");
  console.log(`Rows read:    ${total.toLocaleString()}`);
  console.log(`Rows kept:    ${kept.toLocaleString()}`);
  console.log(`Rows skipped: ${skipped.toLocaleString()}`);
  console.log(`Files:        ${files.length}`);
  console.log(`Total size:   ${(totalBytes / 1024 / 1024).toFixed(1)} MB (gzipped)`);
  console.log(`Output dir:   ${OUT_DIR}`);
}

main().catch((e) => {
  console.error("Error building chunks:", e);
  process.exit(1);
});
