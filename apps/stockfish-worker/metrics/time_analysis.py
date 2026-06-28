from typing import Any, Dict, List, Optional


class TimeAnalyzer:
    """Derives time-management insights from per-move clock data."""

    def analyze_game_time(self, analysis_data: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        moves_with_time = [m for m in analysis_data if m.get("time_spent") is not None]
        if not moves_with_time:
            return None

        times = [m["time_spent"] for m in moves_with_time]
        avg_time = sum(times) / len(times)

        phase_times: Dict[str, List[float]] = {"opening": [], "middlegame": [], "endgame": []}
        for m in moves_with_time:
            phase = m.get("phase", "middlegame")
            if phase in phase_times:
                phase_times[phase].append(m["time_spent"])

        phase_breakdown = {
            phase: round(sum(t) / len(t), 2)
            for phase, t in phase_times.items()
            if t
        }

        # Moves spent under 5 seconds — proxy for time pressure
        time_pressure_moves = [m for m in moves_with_time if m["time_spent"] < 5]
        # Moves with a long think (> 60 s)
        think_moves = [m for m in moves_with_time if m["time_spent"] > 60]

        return {
            "average_time_per_move": round(avg_time, 2),
            "total_time_used": round(sum(times), 2),
            "phase_time_breakdown": phase_breakdown,
            "time_pressure_risk": len(time_pressure_moves) >= 3,
            "time_pressure_move_count": len(time_pressure_moves),
            "think_moves": [
                {"move_num": m.get("move_num"), "san": m.get("san"), "time_spent": m["time_spent"]}
                for m in think_moves
            ],
        }
