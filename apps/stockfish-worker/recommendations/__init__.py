"""
AI Recommendations sub-package.
Generates training plans, study suggestions, and puzzle sets.
"""
import logging

try:
    from worker_core.training_plan import TrainingPlan, TrainingPlanGenerator
    from worker_core.puzzle_generator import PuzzleGenerator
    from worker_core.study_suggestions import StudySuggestions, StudySuggestionEngine
    from worker_core.opening_suggestions import OpeningSuggestions, OpeningSuggestionEngine
except ImportError as e:
    logging.error(f"Error in Recommendations sub-package: {e}")
    TrainingPlan = TrainingPlanGenerator = None
    PuzzleGenerator = None
    StudySuggestions = StudySuggestionEngine = None
    OpeningSuggestions = OpeningSuggestionEngine = None

__all__ = [
    "TrainingPlan", 
    "TrainingPlanGenerator",
    "PuzzleGenerator", 
    "StudySuggestions", 
    "StudySuggestionEngine",
    "OpeningSuggestions", 
    "OpeningSuggestionEngine"
]
