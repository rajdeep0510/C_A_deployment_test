import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  try {
    const res = await fetch(
      `https://api.chess.com/pub/player/${username}/stats`,
      { headers: { "User-Agent": "chess-advisor-app" }, next: { revalidate: 300 } },
    );
    if (!res.ok) return NextResponse.json({ error: "upstream error" }, { status: res.status });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "fetch failed" }, { status: 502 });
  }
}
