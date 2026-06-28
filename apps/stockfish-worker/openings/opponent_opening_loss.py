from typing import Any, Dict, List
from collections import defaultdict


class OpponentOpeningLoss:
    """Finds openings where the player consistently loses to specific opponent setups."""

    def analyze(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        opening_losses: Dict[str, int] = defaultdict(int)
        opening_games:  Dict[str, int] = defaultdict(int)

        for g in results:
            name = g.get("opening_name") or "Unknown"
            opening_games[name] += 1
            if g.get("user_result") == "loss":
                opening_losses[name] += 1

        problematic = [
            {
                "opening":   name,
                "losses":    opening_losses[name],
                "games":     opening_games[name],
                "loss_rate": round(opening_losses[name] / opening_games[name] * 100, 1),
            }
            for name in opening_games
            if opening_games[name] >= 2 and opening_losses[name] / opening_games[name] >= 0.6
        ]

        problematic.sort(key=lambda x: x["loss_rate"], reverse=True)
        return {"problematic_openings": problematic[:5]}
