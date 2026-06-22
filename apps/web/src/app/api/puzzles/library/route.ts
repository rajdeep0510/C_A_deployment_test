import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import readline from "readline";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "10");
    
    const ratingMin = parseInt(searchParams.get("rating_min") || "800");
    const ratingMax = parseInt(searchParams.get("rating_max") || "2500");
    const targetTheme = searchParams.get("theme");
    const targetPhase = searchParams.get("phase");

    const csvPath = path.join(process.cwd(), "puzzle_algo", "lichess_db_puzzle.csv", "lichess_db_puzzle.csv");

    if (!fs.existsSync(csvPath)) {
      return NextResponse.json({ error: "CSV file not found" }, { status: 404 });
    }

    // 🚀 AMAZING TRICK FOR 1.1GB CSV:
    // To ensure fair, truly random puzzle generation across the ENTIRE dataset 
    // without crashing memory or lagging the server, we pick a random byte offset!
    const stats = fs.statSync(csvPath);
    // Give ourselves a 5MB buffer at the end so we don't start reading at the literal last line
    const randomStart = Math.floor(Math.random() * Math.max(0, stats.size - 5000000)); 

    const fileStream = fs.createReadStream(csvPath, { start: randomStart });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let isFirstLine = true;
    const puzzles = [];
    
    for await (const line of rl) {
      // Because we dropped into a random byte location, the first line read is 
      // almost certainly chopped in half. We must skip it to avoid corrupted data.
      if (isFirstLine) {
        isFirstLine = false;
        continue; 
      }
      
      const parts = line.split(',');
      if (parts.length >= 9) {
        const [id, fen, moves, ratingStr, rd, pop, plays, themes, url] = parts;
        const rating = parseInt(ratingStr);
        
        if (isNaN(rating)) continue;
        if (rating < ratingMin || rating > ratingMax) continue;
        if (targetTheme && !themes.includes(targetTheme)) continue;

        let phase = "middlegame";
        if (themes.includes("endgame")) phase = "endgame";
        if (themes.includes("opening")) phase = "opening";
        if (targetPhase && phase !== targetPhase) continue;

        puzzles.push({
          puzzle_id: id,
          fen: fen,
          moves: moves,
          theme: themes,
          difficulty: rating,
          rating: rating,
        });

        // Once we secure enough perfectly matching puzzles, we stop reading.
        if (puzzles.length >= limit * 5) {
          break;
        }
      }
    }
    
    fileStream.destroy();

    // Shuffle the matching pool
    const shuffled = puzzles.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, limit);

    return NextResponse.json({ puzzles: selected });
  } catch (error) {
    console.error("Error serving puzzles locally:", error);
    return NextResponse.json({ error: "Failed to load puzzles" }, { status: 500 });
  }
}
