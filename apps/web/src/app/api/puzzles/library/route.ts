import { NextRequest, NextResponse } from "next/server";
import { loadRandomPuzzles } from "@/lib/puzzles/chunks";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "10");
    const ratingMin = parseInt(searchParams.get("rating_min") || "800");
    const ratingMax = parseInt(searchParams.get("rating_max") || "2500");
    const targetTheme = searchParams.get("theme");
    const targetPhase = searchParams.get("phase");

    // Reads only the rating buckets (and all their parts) overlapping the
    // requested window, instead of scanning the full 1.1GB CSV.
    const selected = await loadRandomPuzzles({
      ratingMin,
      ratingMax,
      limit,
      theme: targetTheme,
      phase: targetPhase,
    });

    return NextResponse.json({ puzzles: selected });
  } catch (error) {
    console.error("Error serving puzzles locally:", error);
    return NextResponse.json({ error: "Failed to load puzzles" }, { status: 500 });
  }
}
