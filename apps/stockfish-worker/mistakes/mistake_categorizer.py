from typing import Any, Dict, List


class MistakeCategorizer:
    """Categorises per-game mistakes by quality, phase, and tactical nature."""

    def categorize_game_mistakes(self, analysis_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        categories: Dict[str, Any] = {
            "blunders":     [],
            "mistakes":     [],
            "inaccuracies": [],
            "by_phase":     {"opening": [], "middlegame": [], "endgame": []},
            "by_nature":    {},
        }

        for move in analysis_data:
            quality = move.get("quality", "")
            phase   = move.get("phase", "middlegame")
            nature  = move.get("error_nature", "None")

            if quality == "Blunder":
                categories["blunders"].append(move)
            elif quality == "Mistake":
                categories["mistakes"].append(move)
            elif quality == "Inaccuracy":
                categories["inaccuracies"].append(move)

            if quality in ("Blunder", "Mistake", "Inaccuracy"):
                if phase in categories["by_phase"]:
                    categories["by_phase"][phase].append(move)
                if nature and nature != "None":
                    categories["by_nature"][nature] = (
                        categories["by_nature"].get(nature, 0) + 1
                    )

        return categories
