from typing import Any, Dict, List


class OpeningRecommendations:
    """Generates actionable study tips based on performance and mistake data."""

    def get_recommendations(
        self,
        performance: Dict[str, Any],
        mistakes: Dict[str, Any],
    ) -> List[str]:
        recs: List[str] = []

        # Flag openings with low win-rate
        for entry in performance.get("by_opening", []):
            if entry["games_played"] >= 3 and entry["win_rate"] < 40:
                recs.append(
                    f"Consider replacing '{entry['opening']}' — only {entry['win_rate']}% win rate."
                )

        # Flag openings with high error rates
        for entry in mistakes.get("worst_openings", []):
            if entry["error_rate"] > 0.5:
                recs.append(
                    f"Study the theory for '{entry['opening']}' — averaging "
                    f"{entry['errors']} mistakes per game in the opening phase."
                )

        if not recs:
            recs.append("Opening play looks solid — focus on middlegame and endgame improvement.")

        return recs[:5]
