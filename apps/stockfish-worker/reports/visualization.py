from typing import List, Dict, Any

class Visualization:
    """Provides data structures formatted for charts and visual dashboards."""
    
    def prepare_accuracy_chart(self, trend_data: Dict[str, Any]) -> Dict[str, Any]:
        """Prepares labels and values for a trend line chart."""
        accuracies = trend_data.get('accuracy_trend', [])
        return {
            "type": "line",
            "labels": [f"Game {i+1}" for i in range(len(accuracies))],
            "data": accuracies,
            "yAxis": "Accuracy %"
        }

    def prepare_mistake_distribution(self, distribution: Dict[str, int]) -> Dict[str, Any]:
        """Prepares labels and values for a pie or bar chart."""
        return {
            "type": "pie",
            "labels": list(distribution.keys()),
            "data": list(distribution.values())
        }

    def prepare_phase_performance_chart(self, phase_perf: Dict[str, float]) -> Dict[str, Any]:
        """Prepares data for a radar or bar chart showing phase strengths."""
        return {
            "type": "radar",
            "labels": list(phase_perf.keys()),
            "data": list(phase_perf.values()),
            "max": 100
        }

class Visualizer(Visualization):
    """Alias for backward compatibility with main __init__.py"""
    pass
