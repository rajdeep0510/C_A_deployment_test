import fs from 'fs';
import readline from 'readline';

// The path to the massive CSV on your machine
const CSV_PATH = 'C:\\Users\\Jennis\\Desktop\\puzzle_algo\\lichess_db_puzzle.csv\\lichess_db_puzzle.csv';

async function main() {
  console.log("Starting puzzle seed from CSV...");
  
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`Could not find CSV at ${CSV_PATH}`);
    process.exit(1);
  }

  const fileStream = fs.createReadStream(CSV_PATH);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let count = 0;
  let batch = [];
  const BATCH_SIZE = 1000;
  const LIMIT = 20000; 

  for await (const line of rl) {
    if (count === 0) {
      count++;
      continue; // skip header
    }

    const parts = line.split(',');
    if (parts.length < 9) continue;

    const [id, fen, moves, ratingStr, rd, pop, plays, themes, url] = parts;
    const rating = parseInt(ratingStr);
    
    if (isNaN(rating)) continue;

    let phase = "middlegame";
    if (themes.includes("endgame")) phase = "endgame";
    if (themes.includes("opening")) phase = "opening";

    batch.push({
      id,
      fen,
      moves,
      rating,
      themes,
      phase,
      game_url: url
    });

    if (batch.length >= BATCH_SIZE) {
      // e.g. await prisma.puzzle_library.createMany({ data: batch, skipDuplicates: true });
      console.log(`Processed ${count} puzzles...`);
      batch = [];
    }

    count++;
    if (count >= LIMIT) break;
  }

  if (batch.length > 0) {
    // await prisma.puzzle_library.createMany({ data: batch, skipDuplicates: true });
  }

  console.log(`Finished processing ${count} puzzles successfully!`);
}

main()
  .catch(e => {
    console.error("Error during processing:", e);
    process.exit(1);
  });
