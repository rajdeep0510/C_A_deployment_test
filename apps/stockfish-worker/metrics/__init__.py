"""
Metrics sub-package for statistical chess analysis.
Calculates win rates, accuracy, and time management performance.
"""
import logging

try:
    from metrics.win_rate import WinRateAnalyzer
    from metrics.accuracy_metrics import AccuracyMetrics
    from metrics.time_analysis import TimeAnalyzer, TimeAnalysis
    from metrics.performance_trends import PerformanceTrendAnalyzer, PerformanceTrends
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
