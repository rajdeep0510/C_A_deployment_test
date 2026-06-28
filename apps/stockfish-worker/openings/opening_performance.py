from typing import Any, Dict, List
from collections import defaultdict


class OpeningPerformance:
    """Per-opening accuracy and win-rate breakdown."""

    def analyze_performance(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        stats: Dict[str, Any] = defaultdict(lambda: {"games": 0, "wins": 0, "accuracy_sum": 0.0})

        for g in results:
            name = g.get("opening_name") or "Unknown"
            stats[name]["games"] += 1
            if g.get("user_result") == "win":
                stats[name]["wins"] += 1
            stats[name]["accuracy_sum"] += g.get("game_accuracy", 0)

        summary = []
        for name, s in stats.items():
            games = s["games"]
            summary.append({
                "opening":      name,
                "games_played": games,
                "win_rate":     round(s["wins"] / games * 100, 1),
                "avg_accuracy": round(s["accuracy_sum"] / games, 2),
            })

        summary.sort(key=lambda x: x["games_played"], reverse=True)
        return {"by_opening": summary[:10]}
