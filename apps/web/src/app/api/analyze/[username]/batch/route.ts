import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const CHESS_COM_HEADERS = { "User-Agent": "ChessAdvisor/1.0" };

async function fetchGameUrlsForBatch(username: string, limit: number): Promise<string[]> {
  // Try Chess.com first
  try {
    const archivesRes = await fetch(
      `https://api.chess.com/pub/player/${username}/games/archives`,
      { headers: CHESS_COM_HEADERS }
    );
    if (archivesRes.ok) {
      const { archives } = await archivesRes.json();
      if (archives?.length) {
        const urls: string[] = [];
        for (const archiveUrl of [...archives].reverse()) {
          if (urls.length >= limit) break;
          const archiveRes = await fetch(archiveUrl, { headers: CHESS_COM_HEADERS });
          if (!archiveRes.ok) continue;
          const { games } = await archiveRes.json();
          for (const game of [...games].reverse()) {
            if (game.url && urls.length < limit) urls.push(game.url);
          }
        }
        if (urls.length > 0) return urls;
      }
    }
  } catch {}

  // Fallback: Lichess
  try {
    const res = await fetch(
      `https://lichess.org/api/games/user/${username}?max=${limit}&pgnInJson=true`,
      { headers: { Accept: "application/x-ndjson" } }
    );
    if (res.ok) {
      const text = await res.text();
      return text
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          try {
            const g = JSON.parse(line);
            return g.id ? `https://lichess.org/${g.id}` : null;
          } catch { return null; }
        })
        .filter((u): u is string => u !== null)
        .slice(0, limit);
    }
  } catch {}

  return [];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 50);

  try {
    const gameUrls = await fetchGameUrlsForBatch(username, limit);

    if (gameUrls.length === 0) {
      return NextResponse.json(
        { error: `No games found for "${username}" on Chess.com or Lichess` },
        { status: 404 }
      );
    }

    const jobs: any[] = [];
    let skipped = 0;
    for (const url of gameUrls) {
      const { data: existing } = await supabaseAdmin
        .from("analysis_jobs")
        .select("id, status")
        .eq("username", username)
        .eq("filename", url)
        .in("status", ["pending", "processing", "completed"])
        .maybeSingle();

      if (existing) { skipped++; continue; }

      const { data, error } = await supabaseAdmin
        .from("analysis_jobs")
        .insert({ username, filename: url, status: "pending" })
        .select()
        .single();
      if (!error && data) jobs.push(data);
    }

    return NextResponse.json({ queued: jobs.length, skipped, jobs });
  } catch (err) {
    console.error("Batch analyze error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
