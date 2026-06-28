from typing import Any, Dict, List


class CriticalMoments:
    """Identifies the moves that most changed the game outcome."""

    def detect_turning_points(self, analysis_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        candidates = [
            {
                "move_num":    m.get("move_num"),
                "san":         m.get("san"),
                "best_move":   m.get("best_move"),
                "cp_loss":     m.get("cp_loss", 0),
                "eval_before": m.get("eval_before"),
                "eval_after":  m.get("eval_after"),
                "phase":       m.get("phase"),
                "error_nature": m.get("error_nature"),
            }
            for m in analysis_data
            if m.get("quality") in ("Blunder", "Mistake") and m.get("cp_loss", 0) >= 100
        ]

        # Return the 5 most impactful moments, sorted by cp_loss descending
        return sorted(candidates, key=lambda x: x["cp_loss"], reverse=True)[:5]
