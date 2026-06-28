from typing import Any, Dict, List

_TACTICAL_NATURES = {
    "Hanging Piece", "Missed Fork", "Missed Pin", "Missed Skewer",
    "Missed Back Rank Mate", "Missed Discovered Attack", "Tactical Oversight",
}
_POSITIONAL_NATURES = {"Positional Misjudgment", "Opening Knowledge"}
_ENDGAME_NATURES    = {"Endgame Technique", "Promotion Error"}


class PatternAggregator:
    """Aggregates tactical / positional / endgame patterns from move data."""

    def aggregate_game_patterns(self, analysis_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        error_counts: Dict[str, int] = {}
        phase_errors  = {"opening": 0, "middlegame": 0, "endgame": 0}

        for move in analysis_data:
            nature  = move.get("error_nature")
            quality = move.get("quality", "")
            phase   = move.get("phase", "middlegame")

            if nature and nature != "None":
                error_counts[nature] = error_counts.get(nature, 0) + 1

            if quality in ("Blunder", "Mistake", "Inaccuracy"):
                if phase in phase_errors:
                    phase_errors[phase] += 1

        tactical   = {k: v for k, v in error_counts.items() if k in _TACTICAL_NATURES}
        positional = {k: v for k, v in error_counts.items() if k in _POSITIONAL_NATURES}
        endgame    = {k: v for k, v in error_counts.items() if k in _ENDGAME_NATURES}
        time_p     = error_counts.get("Time Pressure", 0)

        critical_weaknesses: List[str] = []
        if error_counts.get("Hanging Piece", 0) >= 2:
            critical_weaknesses.append("Leaving pieces undefended")
        if error_counts.get("Missed Fork", 0) >= 1:
            critical_weaknesses.append("Missing fork opportunities")
        if error_counts.get("Missed Back Rank Mate", 0) >= 1:
            critical_weaknesses.append("Back-rank vulnerability")
        if phase_errors.get("endgame", 0) >= 2:
            critical_weaknesses.append("Endgame technique needs work")
        if time_p >= 2:
            critical_weaknesses.append("Blundering under time pressure")

        return {
            "tactical":   {"tactical_summary":   tactical},
            "positional": {"positional_summary": {**positional, "phase_errors": phase_errors}},
            "endgame":    {"endgame_summary":    {**endgame, "endgame_errors": phase_errors["endgame"]}},
            "time_pressure": {"time_pressure_summary": {"time_pressure_errors": time_p}},
            "critical_weaknesses": critical_weaknesses,
        }

    def aggregate_batch_patterns(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        all_moves: List[Dict[str, Any]] = []
        for game in results:
            all_moves.extend(game.get("move_history", []))
        return self.aggregate_game_patterns(all_moves)
