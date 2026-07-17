import { Game } from "@repo/types";

const HEADERS = { "User-Agent": "ChessCoachPlatform/1.0 (Contact: your@email.com)" };

function recentMonthUrls(username: string, count = 12): string[] {
  const now = new Date();
  const urls: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    urls.push(`https://api.chess.com/pub/player/${username}/games/${y}/${m}`);
  }
  return urls;
}

export async function fetchChessComGames(username: string, limit: number, timeClass?: string): Promise<Game[]> {
  try {
    const monthUrls = recentMonthUrls(username, 12);
    const allGames: any[] = [];

    for (const url of monthUrls) {
      if (allGames.length >= limit) break;
      try {
        const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
        if (!res.ok) continue;
        const { games } = await res.json();
        if (!games?.length) continue;
        const batch = ([...games] as any[]).reverse();
        const filtered = timeClass
          ? batch.filter(g => (g.time_class || "").toLowerCase() === timeClass.toLowerCase())
          : batch;
        allGames.push(...filtered.slice(0, limit - allGames.length));
      } catch {
        continue;
      }
    }

    return allGames.slice(0, limit).map((game: any) => {
      let result: string;
      if (game.white?.result === "win") result = "1-0";
      else if (game.black?.result === "win") result = "0-1";
      else result = "1/2-1/2";
      return {
        platform: "chess.com",
        url: game.url,
        filename: game.url,
        pgn: game.pgn,
        white: game.white?.username ?? "",
        black: game.black?.username ?? "",
        white_rating: game.white?.rating,
        black_rating: game.black?.rating,
        result,
        end_time: game.end_time,
        time_class: game.time_class,
        time_control: game.time_control,
      };
    });
  } catch (error) {
    console.error("Error fetching Chess.com games:", error);
    return [];
  }
}

export async function fetchLichessGames(username: string, limit: number): Promise<Game[]> {
  const url = `https://lichess.org/api/games/user/${username}?max=${limit}&pgnInJson=true`;
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/x-ndjson" },
    });
    if (!response.ok) return [];

    const text = await response.text();
    const games = text
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          const game = JSON.parse(line);
          let result: string;
          if (game.winner === "white") result = "1-0";
          else if (game.winner === "black") result = "0-1";
          else result = "1/2-1/2";
          const stdGame: Game = {
            platform: "lichess",
            url: `https://lichess.org/${game.id}`,
            filename: `https://lichess.org/${game.id}`,
            pgn: game.pgn,
            white: game.players.white.user?.name ?? game.players.white.name ?? "",
            black: game.players.black.user?.name ?? game.players.black.name ?? "",
            result,
            end_time: game.createdAt,
          };
          return stdGame;
        } catch (e) {
          return null;
        }
      })
      .filter((g): g is Game => g !== null);

    return games;
  } catch (error) {
    console.error("Error fetching Lichess games:", error);
    return [];
  }
}
