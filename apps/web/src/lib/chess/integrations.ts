import { Game } from "@repo/types";

const HEADERS = { "User-Agent": "ChessCoachPlatform/1.0 (Contact: your@email.com)" };

export async function fetchChessComGames(username: string, limit: number): Promise<Game[]> {
  const archivesUrl = `https://api.chess.com/pub/player/${username}/games/archives`;
  try {
    const response = await fetch(archivesUrl, { headers: HEADERS });
    if (!response.ok) return [];

    const { archives } = await response.json();
    if (!archives || archives.length === 0) return [];

    const allGames: any[] = [];
    for (const archiveUrl of [...archives].reverse()) {
      const archiveResponse = await fetch(archiveUrl, { headers: HEADERS });
      if (archiveResponse.ok) {
        const { games } = await archiveResponse.json();
        allGames.push(...[...games].reverse());
        if (allGames.length >= limit) break;
      }
    }

    return allGames.slice(0, limit).map((game: any) => ({
      platform: "chess.com",
      url: game.url,
      pgn: game.pgn,
      white: game.white.username,
      black: game.black.username,
      result: game.white.result,
      end_time: game.end_time,
    }));
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
          const stdGame: Game = {
            platform: "lichess",
            url: `https://lichess.org/${game.id}`,
            pgn: game.pgn,
            white: game.players.white.user.name,
            black: game.players.black.user.name,
            result: game.winner,
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
