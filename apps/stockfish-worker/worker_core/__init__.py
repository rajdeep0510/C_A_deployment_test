"""
Core analysis engine sub-package.
Handles Stockfish integration, game-level analysis, and batch processing.
"""
import logging

try:
    from worker_core.engine_manager import EngineManager
    from worker_core.game_analyzer import GameAnalyzer
    from worker_core.batch_analyzer import BatchAnalyzer
    from worker_core.move_classifier import MoveClassifier
except ImportError as e:
    logging.error(f"Error in Core sub-package: {e}")
    EngineManager = GameAnalyzer = BatchAnalyzer = MoveClassifier = None

__all__ = ["EngineManager", "GameAnalyzer", "BatchAnalyzer", "MoveClassifier"]
