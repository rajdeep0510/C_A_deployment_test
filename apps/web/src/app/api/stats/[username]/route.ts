import { NextRequest, NextResponse } from "next/server";
import { fetchChessComGames, fetchLichessGames } from "@/lib/chess/integrations";
import { calculateWinRate } from "@/lib/chess/stats";
import { requireAnalysisAuth } from "@/lib/analysis-security";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  // Stats reveal a user's analyzed PGNs — require a session (R4).
  const guard = await requireAnalysisAuth(request, "stats:get", {
    perIp: 60,
    perUser: 120,
  });
  if (guard.response) return guard.response;
  
  // For the purpose of stats, we'll fetch a larger sample of games
  // In a real app, these would be cached or stored in a DB
  const [chessComGames, lichessGames] = await Promise.all([
    fetchChessComGames(username, 50),
    fetchLichessGames(username, 50)
  ]);

  const allGames = [...chessComGames, ...lichessGames];
  
  if (allGames.length === 0) {
    return NextResponse.json({ error: "No games found for this user" }, { status: 404 });
  }

  const stats = calculateWinRate(username, allGames);
  return NextResponse.json(stats);
}
