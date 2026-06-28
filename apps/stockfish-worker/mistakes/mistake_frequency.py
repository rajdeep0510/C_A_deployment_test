from typing import Any, Dict, List


class MistakeFrequency:
    """Counts how often each mistake type appears, per game or across a batch."""

    def analyze_frequency(self, analysis_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        freq: Dict[str, int] = {"blunders": 0, "mistakes": 0, "inaccuracies": 0}
        nature_freq: Dict[str, int] = {}
        phase_freq: Dict[str, int] = {"opening": 0, "middlegame": 0, "endgame": 0}

        for move in analysis_data:
            quality = move.get("quality", "")
            phase   = move.get("phase", "middlegame")
            nature  = move.get("error_nature")

            if quality == "Blunder":
                freq["blunders"] += 1
            elif quality == "Mistake":
                freq["mistakes"] += 1
            elif quality == "Inaccuracy":
                freq["inaccuracies"] += 1

            if quality in ("Blunder", "Mistake", "Inaccuracy"):
                if phase in phase_freq:
                    phase_freq[phase] += 1
                if nature and nature != "None":
                    nature_freq[nature] = nature_freq.get(nature, 0) + 1

        total = sum(freq.values())
        return {
            "counts":       freq,
            "total_errors": total,
            "by_phase":     phase_freq,
            "by_nature":    nature_freq,
            "error_rate":   round(total / len(analysis_data) * 100, 1) if analysis_data else 0.0,
        }

    def aggregate_batch_frequency(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        all_moves: List[Dict[str, Any]] = []
        for game in results:
            all_moves.extend(game.get("move_history", []))
        freq = self.analyze_frequency(all_moves)
        freq["games_analyzed"] = len(results)
        if results:
            freq["errors_per_game"] = round(freq["total_errors"] / len(results), 2)
        return freq
