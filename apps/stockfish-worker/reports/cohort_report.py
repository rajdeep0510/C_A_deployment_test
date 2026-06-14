from typing import List, Dict, Any
from config.thresholds import RATING_RANGES

class CohortReport:
    """Compares a student's performance against global rating benchmarks (cohorts)."""
    
    def generate_benchmark_report(self, analysis: Dict[str, Any], rating: int) -> Dict[str, Any]:
        """Compares user's accuracy and errors against their rating group."""
        cohort = self._get_cohort_name(rating)
        benchmarks = self._get_cohort_benchmarks(cohort)
        
        user_acc = analysis.get('average_accuracy') or analysis.get('game_accuracy', 0)
        gap = user_acc - benchmarks['avg_accuracy']
        
        return {
            "cohort": cohort,
            "user_rating": rating,
            "comparison": {
                "accuracy": user_acc,
                "cohort_avg": benchmarks['avg_accuracy'],
                "gap": round(gap, 2)
            },
            "insight": self._generate_cohort_insight(gap, cohort),
            "percentile_estimate": self._estimate_percentile(user_acc, benchmarks)
        }

    def _get_cohort_name(self, rating: int) -> str:
        for name, (min_r, max_r) in RATING_RANGES.items():
            if min_r <= rating <= max_r:
                return name
        return "unknown"

    def _get_cohort_benchmarks(self, cohort: str) -> Dict[str, Any]:
        # Typical accuracies for different levels (simplified)
        cohort_data = {
            'beginner': {'avg_accuracy': 55, 'mistakes_per_game': 5},
            'intermediate': {'avg_accuracy': 70, 'mistakes_per_game': 3},
            'advanced': {'avg_accuracy': 80, 'mistakes_per_game': 1.5},
            'expert': {'avg_accuracy': 88, 'mistakes_per_game': 0.8},
            'master': {'avg_accuracy': 94, 'mistakes_per_game': 0.3}
        }
        return cohort_data.get(cohort, {'avg_accuracy': 65, 'mistakes_per_game': 4})

    def _generate_cohort_insight(self, gap: float, cohort: str) -> str:
        if gap > 5:
            return f"You are significantly outperforming your {cohort} peers."
        elif gap < -5:
            return f"Your accuracy is currently below the average for the {cohort} level."
        return f"Your performance is consistent with other {cohort} players."

    def _estimate_percentile(self, acc: float, benchmarks: Dict[str, Any]) -> int:
        # Very rough estimation logic
        base = 50
        diff = acc - benchmarks['avg_accuracy']
        return max(1, min(99, int(base + (diff * 3))))

class CohortReportGenerator(CohortReport):
    """Alias for backward compatibility with main __init__.py"""
    pass
