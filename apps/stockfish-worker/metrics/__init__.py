"""
Metrics sub-package for statistical chess analysis.
Calculates win rates, accuracy, and time management performance.
"""
import logging

try:
    from worker_core.win_rate import WinRateAnalyzer
    from worker_core.accuracy_metrics import AccuracyMetrics
    from worker_core.time_analysis import TimeAnalyzer, TimeAnalysis
    from worker_core.performance_trends import PerformanceTrendAnalyzer, PerformanceTrends
except ImportError as e:
    logging.error(f"Error in Metrics sub-package: {e}")
    WinRateAnalyzer = AccuracyMetrics = TimeAnalyzer = PerformanceTrendAnalyzer = None
    TimeAnalysis = PerformanceTrends = None

__all__ = [
    "WinRateAnalyzer", 
    "AccuracyMetrics", 
    "TimeAnalyzer", 
    "TimeAnalysis", 
    "PerformanceTrendAnalyzer",
    "PerformanceTrends"
]
