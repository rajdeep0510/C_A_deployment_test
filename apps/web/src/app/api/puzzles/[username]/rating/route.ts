import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;

  const { data } = await supabaseAdmin
    .from("player_puzzle_rating")
    .select("rating, rd, streak_days, calibrated, last_active_date")
    .eq("username", username)
    .maybeSingle();

  return NextResponse.json(
    data ?? { rating: 1200, rd: 350, streak_days: 0, calibrated: false },
  );
}
