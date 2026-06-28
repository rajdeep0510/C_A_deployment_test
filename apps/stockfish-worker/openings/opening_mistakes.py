from typing import Any, Dict, List
from collections import defaultdict


class OpeningMistakes:
    """Finds openings where the player most frequently makes early mistakes."""

    def analyze_mistakes(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        opening_errors: Dict[str, int] = defaultdict(int)
        opening_games:  Dict[str, int] = defaultdict(int)

        for g in results:
            name = g.get("opening_name") or "Unknown"
            opening_games[name] += 1
            for move in g.get("move_history", []):
                if move.get("phase") == "opening" and move.get("quality") in ("Blunder", "Mistake"):
                    opening_errors[name] += 1

        worst = sorted(
            opening_games.keys(),
            key=lambda n: opening_errors.get(n, 0) / opening_games[n],
            reverse=True,
        )[:5]

        return {
            "worst_openings": [
                {
                    "opening":        name,
                    "errors":         opening_errors.get(name, 0),
                    "games":          opening_games[name],
                    "error_rate":     round(opening_errors.get(name, 0) / opening_games[name], 2),
                }
                for name in worst
            ]
        }
