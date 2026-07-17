import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;

  const data = await prisma.player_puzzle_rating.findUnique({
    where: { username },
    select: { rating: true, rd: true, streak_days: true, calibrated: true, last_active_date: true },
  });

  return NextResponse.json(
    data ?? { rating: 1200, rd: 350, streak_days: 0, calibrated: false },
  );
}
