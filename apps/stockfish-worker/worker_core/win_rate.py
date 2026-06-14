import os
import chess.pgn
from typing import Dict, Any, List, Optional

class WinRateAnalyzer:
    """Calculates wins, losses, and draws for a player across multiple games."""
    
    def __init__(self, games_dir: Optional[str] = None):
        if games_dir is None:
            # Default to data/games in the backend directory
            base_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            self.games_dir = os.path.join(base_path, "data", "games")
        else:
            self.games_dir = games_dir

    def calculate_win_rate(self, player_id: str) -> Dict[str, Any]:
        """Scans all PGNs for a player and returns aggregated statistics."""
        player_games_dir = os.path.join(self.games_dir, player_id)
        if not os.path.exists(player_games_dir):
            return {"error": "Player directory not found"}

        stats = {
            "total_games": 0,
            "white": {"wins": 0, "losses": 0, "draws": 0, "total": 0},
            "black": {"wins": 0, "losses": 0, "draws": 0, "total": 0},
            "overall": {"wins": 0, "losses": 0, "draws": 0},
            "time_controls": {},
            "results": {},
            "total_moves": 0
        }

        for filename in os.listdir(player_games_dir):
            if not filename.endswith(".pgn"):
                continue
            
            filepath = os.path.join(player_games_dir, filename)
            with open(filepath, "r", encoding="utf-8") as f:
                game = chess.pgn.read_headers(f)
                if not game:
                    continue

                white_player = game.get("White", "").lower()
                black_player = game.get("Black", "").lower()
                result = game.get("Result", "*")
                time_control = game.get("TimeControl", "Unknown")
                termination = game.get("Termination", "Unknown")
                
                stats["total_games"] += 1
                
                # Track Time Controls
                if time_control not in stats["time_controls"]:
                    stats["time_controls"][time_control] = {"wins": 0, "losses": 0, "draws": 0, "total": 0}
                stats["time_controls"][time_control]["total"] += 1

                # Track Results (Termination Reasons)
                if termination not in stats["results"]:
                    stats["results"][termination] = 0
                stats["results"][termination] += 1

                if white_player == player_id.lower():
                    stats["white"]["total"] += 1
                    if result == "1-0":
                        stats["white"]["wins"] += 1
                        stats["overall"]["wins"] += 1
                        stats["time_controls"][time_control]["wins"] += 1
                    elif result == "0-1":
                        stats["white"]["losses"] += 1
                        stats["overall"]["losses"] += 1
                        stats["time_controls"][time_control]["losses"] += 1
                    elif result == "1/2-1/2":
                        stats["white"]["draws"] += 1
                        stats["overall"]["draws"] += 1
                        stats["time_controls"][time_control]["draws"] += 1
                elif black_player == player_id.lower():
                    stats["black"]["total"] += 1
                    if result == "0-1":
                        stats["black"]["wins"] += 1
                        stats["overall"]["wins"] += 1
                        stats["time_controls"][time_control]["wins"] += 1
                    elif result == "1-0":
                        stats["black"]["losses"] += 1
                        stats["overall"]["losses"] += 1
                        stats["time_controls"][time_control]["losses"] += 1
                    elif result == "1/2-1/2":
                        stats["black"]["draws"] += 1
                        stats["overall"]["draws"] += 1
                        stats["time_controls"][time_control]["draws"] += 1

        def calc_pct(count, total):
            return round((count / total) * 100, 2) if total > 0 else 0

        total = stats["total_games"]
        
        # Clean up time control stats for response
        tc_stats = {}
        for tc, s in stats["time_controls"].items():
            tc_stats[tc] = {
                "total": s["total"],
                "win_rate": calc_pct(s["wins"], s["total"])
            }

        return {
            "username": player_id,
            "total_games": total,
            "overall_win_rate": calc_pct(stats["overall"]["wins"], total),
            "white_stats": {
                "total": stats["white"]["total"],
                "win_rate": calc_pct(stats["white"]["wins"], stats["white"]["total"]),
                "loss_rate": calc_pct(stats["white"]["losses"], stats["white"]["total"]),
                "draw_rate": calc_pct(stats["white"]["draws"], stats["white"]["total"]),
            },
            "black_stats": {
                "total": stats["black"]["total"],
                "win_rate": calc_pct(stats["black"]["wins"], stats["black"]["total"]),
                "loss_rate": calc_pct(stats["black"]["losses"], stats["black"]["total"]),
                "draw_rate": calc_pct(stats["black"]["draws"], stats["black"]["total"]),
            },
            "time_control_performance": tc_stats,
            "termination_reasons": stats["results"]
        }
