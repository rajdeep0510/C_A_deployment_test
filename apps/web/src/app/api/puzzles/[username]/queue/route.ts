import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const { searchParams } = req.nextUrl;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
  const phase = searchParams.get("phase");

  let q = supabaseAdmin
    .from("puzzles")
    .select("puzzle_id, fen, best_move, theme, difficulty, phase, puzzle_rating, game_filename, move_number")
    .eq("username", username)
    .eq("source", "own_game")
    .order("created_at", { ascending: false })
    .limit(200);

  if (phase) q = q.eq("phase", phase);

  const { data: allPuzzles, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!allPuzzles?.length) return NextResponse.json({ queue: [] });

  const ids = allPuzzles.map((p) => p.puzzle_id);

  const { data: progress } = await supabaseAdmin
    .from("puzzle_progress")
    .select("puzzle_id, attempts, next_review, last_solved")
    .eq("username", username)
    .in("puzzle_id", ids);

  const progressMap = new Map((progress ?? []).map((p) => [p.puzzle_id, p]));
  const today = new Date().toISOString().split("T")[0];

  // Priority: due for review > unseen > already solved and not due
  const due: any[]    = [];
  const unseen: any[] = [];
  const rest: any[]   = [];

  for (const p of allPuzzles) {
    const pp = progressMap.get(p.puzzle_id);
    if (!pp || pp.attempts === 0) { unseen.push(p); continue; }
    if (pp.next_review <= today)  { due.push(p);    continue; }
    rest.push(p);
  }

  const queue = [...due, ...unseen, ...rest]
    .slice(0, limit)
    .map((p) => ({ ...p, source: "own_game" }));

  return NextResponse.json({ queue });
}
