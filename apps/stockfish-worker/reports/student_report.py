from typing import Dict, Any, List

class StudentReport:
    """Generates a comprehensive summary report for a student based on game analysis."""
    
    def generate_single_game_report(self, analysis_result: Dict[str, Any]) -> Dict[str, Any]:
        """Creates a human-readable summary of a single game's performance."""
        metadata = analysis_result.get('metadata', {})
        accuracy = analysis_result.get('game_accuracy', 0)
        user_color = analysis_result.get('user_color', 'white')
        
        # Determine overall grade
        grade = self._calculate_grade(accuracy)
        
        # Extract key highlights
        mistakes = analysis_result.get('mistakes', {})
        turning_points = mistakes.get('critical_moments', [])
        
        # Extract Ratings
        user_rating = analysis_result.get('white_rating') if user_color == 'white' else analysis_result.get('black_rating')
        opponent_rating = analysis_result.get('black_rating') if user_color == 'white' else analysis_result.get('white_rating')
        
        return {
            "summary": {
                "player": analysis_result.get('white_player') if user_color == 'white' else analysis_result.get('black_player'),
                "player_rating": user_rating,
                "performance_rating": analysis_result.get('performance_rating', 0),
                "opponent": analysis_result.get('black_player') if user_color == 'white' else analysis_result.get('white_player'),
                "opponent_rating": opponent_rating,
                "accuracy": accuracy,
                "grade": grade,
                "opening": analysis_result.get('opening_name', 'Unknown'),
                "eco_code": analysis_result.get('eco_code', 'N/A')
            },
            "performance_notes": self._generate_performance_notes(analysis_result),
            "critical_moments_count": len(turning_points),
            "top_recommendation": self._get_top_recommendation(analysis_result)
        }

    def _calculate_grade(self, accuracy: float) -> str:
        if accuracy >= 90: return "Brilliant (A+)"
        if accuracy >= 80: return "Excellent (A)"
        if accuracy >= 70: return "Good (B)"
        if accuracy >= 60: return "Fair (C)"
        return "Needs Improvement (D)"

    def _generate_performance_notes(self, result: Dict[str, Any]) -> List[str]:
        notes = []
        patterns = result.get('patterns', {})
        
        # Check for time pressure
        tp = patterns.get('time_pressure', {}).get('total_time_pressure_errors', 0)
        if tp > 2:
            notes.append(f"You struggled with time management, making {tp} errors under pressure.")
            
        # Check for tactical oversights
        tactical = patterns.get('tactical', {}).get('total_tactical_errors', 0)
        if tactical > 2:
            notes.append(f"Tactics were a major factor in this game, with {tactical} significant oversights.")
            
        return notes

    def _get_top_recommendation(self, result: Dict[str, Any]) -> str:
        # Simplified logic for now
        mistakes = result.get('mistakes', {}).get('categories', {})
        if any("opening" in k for k in mistakes):
            return "Spend more time reviewing opening theory for this line."
        return "Focus on tactical puzzles to reduce unforced errors."

class StudentReportGenerator(StudentReport):
    """Alias for backward compatibility with main __init__.py"""
    pass
