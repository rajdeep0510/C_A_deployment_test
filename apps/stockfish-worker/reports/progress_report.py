from typing import List, Dict, Any

class ProgressReport:
    """Aggregates multiple game results to identify long-term improvement and trends."""
    
    def generate_batch_report(self, batch_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Summarizes progress across multiple analyzed games."""
        username = batch_analysis.get('username', 'Student')
        num_games = batch_analysis.get('total_analyzed', 0)
        
        # Calculate summary metrics
        avg_acc = batch_analysis.get('average_accuracy', 0)
        phase_perf = batch_analysis.get('phase_performance', {})
        
        return {
            "title": f"Progress Report for {username}",
            "period_summary": {
                "games_analyzed": num_games,
                "overall_avg_accuracy": avg_acc,
                "current_momentum": batch_analysis.get('trends', {}).get('current_momentum', 'Stable')
            },
            "strengths_weaknesses": self._summarize_strengths_weaknesses(batch_analysis),
            "repertoire_snapshot": self._get_repertoire_snapshot(batch_analysis),
            "top_action_items": batch_analysis.get('patterns', {}).get('critical_weaknesses', [])
        }

    def _summarize_strengths_weaknesses(self, batch: Dict[str, Any]) -> Dict[str, List[str]]:
        strengths = []
        weaknesses = []
        
        # Phase-based insights
        phase_perf = batch.get('phase_performance', {})
        for phase, acc in phase_perf.items():
            if acc >= 80: strengths.append(f"High accuracy in the {phase} phase.")
            elif acc < 60: weaknesses.append(f"Frequent struggles in the {phase} phase.")
            
        return {"strengths": strengths, "weaknesses": weaknesses}

    def _get_repertoire_snapshot(self, batch: Dict[str, Any]) -> Dict[str, Any]:
        openings = batch.get('openings', {}).get('repertoire', {})
        top = openings.get('top_openings', {})
        return {
            "user_as_white": [o['opening'] for o in top.get('user_white', [])],
            "user_as_black": [o['opening'] for o in top.get('user_black', [])],
            "opponents_against_your_white": [o['opening'] for o in top.get('opp_against_white', [])],
            "opponents_against_your_black": [o['opening'] for o in top.get('opp_against_black', [])]
        }

class ProgressReportGenerator(ProgressReport):
    """Alias for backward compatibility with main __init__.py"""
    pass
