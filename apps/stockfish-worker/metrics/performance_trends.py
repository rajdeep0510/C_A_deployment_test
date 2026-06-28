from typing import Any, Dict, List


class PerformanceTrendAnalyzer:
    """Detects accuracy trends across a batch of games."""

    def calculate_trends(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not results:
            return {"trend": "insufficient_data"}

        accuracies = [g.get("game_accuracy", 0) for g in results]
        avg = sum(accuracies) / len(accuracies)

        if len(accuracies) < 3:
            return {
                "trend": "insufficient_data",
                "average_accuracy": round(avg, 2),
                "momentum": "Stable",
            }

        mid = len(accuracies) // 2
        recent = accuracies[:mid]   # results are newest-first
        older  = accuracies[mid:]

        recent_avg = sum(recent) / len(recent)
        older_avg  = sum(older)  / len(older)
        diff = recent_avg - older_avg

        if diff > 5:
            trend, momentum = "improving", "Improving"
        elif diff < -5:
            trend, momentum = "declining", "Declining"
        else:
            trend, momentum = "stable", "Stable"

        return {
            "trend": trend,
            "momentum": momentum,
            "average_accuracy": round(avg, 2),
            "recent_accuracy":  round(recent_avg, 2),
            "older_accuracy":   round(older_avg, 2),
            "delta":            round(diff, 2),
        }
