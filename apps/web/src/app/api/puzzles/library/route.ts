import { NextRequest, NextResponse } from "next/server";
import { resolveCsvUrl, EloBracket } from "@/lib/puzzles/resolver";
import { sampleCsv } from "@/lib/puzzles/parser";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const puzzleType = searchParams.get("type")       ?? "phase_middlegame";
  const difficulty  = (searchParams.get("difficulty") ?? "intermediate") as EloBracket;
  const limit       = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);

  const csvUrl = resolveCsvUrl(puzzleType, difficulty);

  let text: string;
  try {
    const res = await fetch(csvUrl, { next: { revalidate: 86400 } });
    if (!res.ok) throw new Error(`CSV fetch failed: ${res.status} — ${csvUrl}`);
    text = await res.text();
  } catch (err) {
    console.error("[puzzles/library]", err);
    return NextResponse.json({ error: "Failed to fetch puzzle data" }, { status: 502 });
  }

  const puzzles = sampleCsv(text, limit);
  return NextResponse.json({ puzzles });
}
