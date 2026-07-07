export type LibraryPuzzle = {
  puzzle_id:   string;
  fen:         string;
  moves:       string;
  rating:      number;
  themes:      string;
  gameUrl:     string;
  openingTags: string;
};

function parseHeader(line: string): string[] {
  return line.split(",").map(h => h.trim());
}

function parseLine(line: string, headers: string[]): LibraryPuzzle | null {
  const values = line.split(",");
  const get = (col: string) => values[headers.indexOf(col)]?.trim() ?? "";

  const puzzle_id = get("PuzzleId");
  const fen       = get("FEN");
  const moves     = get("Moves");

  if (!puzzle_id || !fen || !moves) return null;

  return {
    puzzle_id,
    fen,
    moves,
    rating:      parseInt(get("Rating")) || 0,
    themes:      get("Themes"),
    gameUrl:     get("GameUrl"),
    openingTags: get("OpeningTags"),
  };
}

// Reads `count` random rows from a CSV string without parsing every row.
export function sampleCsv(text: string, count: number): LibraryPuzzle[] {
  const lines = text.split("\n");
  if (lines.length < 2) return [];

  const headers   = parseHeader(lines[0]);
  const dataLines = lines.slice(1).filter(l => l.trim().length > 0);
  if (dataLines.length === 0) return [];

  const n      = Math.min(count, dataLines.length);
  const picked = new Set<number>();
  while (picked.size < n) {
    picked.add(Math.floor(Math.random() * dataLines.length));
  }

  const results: LibraryPuzzle[] = [];
  for (const idx of picked) {
    const parsed = parseLine(dataLines[idx], headers);
    if (parsed) results.push(parsed);
  }
  return results;
}
