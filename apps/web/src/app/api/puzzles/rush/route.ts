import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import readline from "readline";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const count = parseInt(searchParams.get("count") || "60");

    const csvPath = path.join(process.cwd(), "puzzle_algo", "lichess_db_puzzle.csv", "lichess_db_puzzle.csv");

    if (!fs.existsSync(csvPath)) {
      return NextResponse.json({ error: "CSV file not found" }, { status: 404 });
    }

    // 🚀 Pick a completely random byte offset so Rush mode draws from 
    // a different part of the 1.1GB CSV every single time you play!
    const stats = fs.statSync(csvPath);
    const randomStart = Math.floor(Math.random() * Math.max(0, stats.size - 10000000)); 

    const fileStream = fs.createReadStream(csvPath, { start: randomStart });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let isFirstLine = true;
    const puzzles = [];
    
    for await (const line of rl) {
      if (isFirstLine) { isFirstLine = false; continue; }
      
      const parts = line.split(',');
      if (parts.length >= 9) {
        const [id, fen, moves, ratingStr, rd, pop, plays, themes, url] = parts;
        const rating = parseInt(ratingStr);
        if (isNaN(rating)) continue;

        puzzles.push({
          puzzle_id: id,
          fen: fen,
          moves: moves,
          theme: themes,
          difficulty: rating,
          rating: rating,
        });

        // We grab a massive pool of puzzles to ensure a smooth ladder
        if (puzzles.length >= count * 20) {
          break;
        }
      }
    }
    
    fileStream.destroy();

    // Sort strictly by Rating (ascending) to recreate the Ladder progression
    const sorted = puzzles.sort((a, b) => a.rating - b.rating);
    const selected = sorted.slice(0, count);

    return NextResponse.json({ puzzles: selected });
  } catch (error) {
    console.error("Error serving rush puzzles locally:", error);
    return NextResponse.json({ error: "Failed to load rush puzzles" }, { status: 500 });
  }
}
