import { NextRequest, NextResponse } from "next/server";
import { loadLadderPuzzles } from "@/lib/puzzles/chunks";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const count = parseInt(searchParams.get("count") || "60");
    // Optional rating span for the ladder (defaults recreate the original spread).
    const ratingMin = parseInt(searchParams.get("rating_min") || "800");
    const ratingMax = parseInt(searchParams.get("rating_max") || "2400");

    // Samples across the rating buckets and sorts ascending (easy -> hard) to
    // recreate the Python ladder mode's progressive difficulty.
    const selected = await loadLadderPuzzles(count, ratingMin, ratingMax);

    return NextResponse.json({ puzzles: selected });
  } catch (error) {
    console.error("Error serving rush puzzles locally:", error);
    return NextResponse.json({ error: "Failed to load rush puzzles" }, { status: 500 });
  }
}
