import os
import chess.pgn
import logging
from typing import Callable, List, Dict, Any, Optional
from worker_core.game_analyzer import GameAnalyzer
from worker_core.engine_manager import EngineManager
from metrics.time_analysis import TimeAnalyzer
from metrics.performance_trends import PerformanceTrendAnalyzer
from openings.opening_repertoire import OpeningRepertoire
from openings.opening_performance import OpeningPerformance
from openings.opening_mistakes import OpeningMistakes
from openings.opening_recommendations import OpeningRecommendations
from openings.opponent_opening_loss import OpponentOpeningLoss
from patterns.pattern_aggregator import PatternAggregator
from mistakes.mistake_frequency import MistakeFrequency
from storage.analysis_storage import AnalysisStorage

logger = logging.getLogger(__name__)

# Type aliases for the Supabase-backed cache callbacks
CacheLookup = Callable[[str, str], Optional[Dict[str, Any]]]  # (username, game_url) -> result | None
CacheSave   = Callable[[str, str, Dict[str, Any]], None]       # (username, game_url, result) -> None


class BatchAnalyzer:
    """Handles analysis of multiple games, providing aggregated statistics."""
    
    def __init__(self, engine_path: str = None):
        self.engine_manager = EngineManager(stockfish_path=engine_path, batch_mode=True)
        self.analyzer = GameAnalyzer(engine_manager=self.engine_manager)
        self.time_analyzer = TimeAnalyzer()
        self.trend_analyzer = PerformanceTrendAnalyzer()
        
        # Opening Analyzers
        self.opening_repertoire = OpeningRepertoire()
        self.opening_performance = OpeningPerformance()
        self.opening_mistakes = OpeningMistakes()
        self.opening_recommendations = OpeningRecommendations()
        self.opponent_opening_loss = OpponentOpeningLoss()
        
        # Pattern Analyzers
        self.pattern_aggregator = PatternAggregator()

        # Mistake Analyzers
        self.mistake_frequency = MistakeFrequency()

        # Disk cache (kept for analyze_directory path only)
        self.storage = AnalysisStorage()

    def analyze_directory(self, directory_path: str, username: str, limit: int = 10) -> Dict[str, Any]:
        """Analyzes all PGN files in a directory for a specific user."""
        def _sort_key(fname):
            stem = fname[:-4]  # strip .pgn
            last = stem.rsplit("_", 1)[-1]
            return int(last) if last.isdigit() else 0

        pgn_files = sorted(
            [f for f in os.listdir(directory_path) if f.endswith(".pgn")],
            key=_sort_key,
            reverse=True,
        )[:limit]

        # Fast path: persisted aggregate is still fresh (no PGN newer than the report)
        cached_report = self.storage.get_batch_report(username, limit, directory_path)
        if cached_report:
            logger.info("Batch report cache hit for %s (limit=%d)", username, limit)
            return cached_report

        # Incremental path: reuse raw results for games already processed, only
        # run Stockfish on files that are genuinely new.
        old_raw = self.storage.get_batch_raw(username, limit) or []
        old_by_file = {r['filename']: r for r in old_raw if r.get('filename')}

        new_files = [f for f in pgn_files if f not in old_by_file]
        if new_files:
            logger.info("Incremental update: %d new game(s) to analyse for %s", len(new_files), username)

        new_results = []
        engine_started = False
        try:
            for filename in new_files:
                filepath = os.path.join(directory_path, filename)
                pgn_mtime = os.path.getmtime(filepath)

                # Individual JSON cache may already exist (e.g. from a prior single-game analysis)
                if self.storage.is_fresh(username, filename, pgn_mtime):
                    cached = self.storage.get_analysis(username, filename)
                    if cached:
                        cached['filename'] = filename
                        new_results.append(cached)
                        logger.info(f"Cache hit: {filename}")
                        continue

                if not engine_started:
                    self.engine_manager.start()
                    engine_started = True

                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        game = chess.pgn.read_game(f)
                        if game:
                            analysis = self.analyzer.analyze_game(game, username)
                            analysis['filename'] = filename
                            self.storage.save_analysis(username, filename, analysis)
                            new_results.append(analysis)
                            logger.info(f"Analyzed {filename}")
                except OSError as e:
                    logger.error("Could not read %s: %s", filename, e)
                except ValueError as e:
                    logger.error("Invalid PGN in %s: %s", filename, e)
                except Exception:
                    logger.exception("Unexpected error analysing %s", filename)
        finally:
            if engine_started:
                self.engine_manager.stop()

        # Merge new results with reused old results, preserving recency order
        all_by_file = {**old_by_file, **{r['filename']: r for r in new_results}}
        all_results = [all_by_file[f] for f in pgn_files if f in all_by_file]

        report = self._aggregate_results(all_results, username)
        self.storage.save_batch_report(username, limit, report)
        self.storage.save_batch_raw(username, limit, all_results)
        return report

    def analyze_pgn_list(
        self,
        pgn_strings: List[str],
        username: str,
        labels: Optional[List[str]] = None,
        on_progress: Optional[Callable[[int, int, str], None]] = None,
        cache_lookup: Optional[CacheLookup] = None,
        cache_save: Optional[CacheSave] = None,
    ) -> Dict[str, Any]:
        """Analyzes a list of PGN strings with a three-level cache priority.

        Priority per game (highest accuracy first):
          1. Individual game analysis result from Supabase (500K nodes)
          2. Previous batch analysis result from Supabase (time-based)
          3. Fresh batch analysis — engine runs at BATCH_ANALYSIS_TIME

        Args:
            pgn_strings:   Raw PGN text for each game.
            username:      Player username used to determine user color.
            labels:        Original game URL per entry — used as the cache key
                           and for progress reporting. Must match pgn_strings length.
            on_progress:   Called after each game: (games_done, games_total, label).
            cache_lookup:  (username, game_url) -> cached result dict or None.
                           Checks Supabase — individual results take priority over
                           batch results because the caller stores them that way.
            cache_save:    (username, game_url, result) -> None.
                           Persists a fresh batch result so the next run skips it.
        """
        results = []
        total = len(pgn_strings)
        engine_started = False

        try:
            for i, pgn_text in enumerate(pgn_strings):
                label = (labels[i] if labels and i < len(labels) else None) or f"game_{i + 1}"

                # ── Priority 1 & 2: Supabase cache (individual beats batch via upsert rules)
                cached = cache_lookup(username, label) if cache_lookup else None
                if cached:
                    logger.info("Cache hit — skipping engine: %s", label)
                    # Inject the game URL as filename so individual_games[].filename is
                    # populated — the report route uses it to merge per-game accuracies.
                    results.append({**cached, "filename": label})
                else:
                    # ── Priority 3: run the engine
                    if not engine_started:
                        self.engine_manager.start()
                        engine_started = True
                    try:
                        analysis = self.analyzer.analyze_pgn(pgn_text, username)
                        analysis["filename"] = label  # URL → enables route-side accuracy merge
                        results.append(analysis)
                        # Save as a batch-level result (won't overwrite individual analysis)
                        if cache_save:
                            try:
                                cache_save(username, label, analysis)
                            except Exception:
                                logger.warning("cache_save failed for %s — continuing", label)
                    except ValueError as e:
                        logger.error("Invalid PGN string: %s", e)
                    except Exception:
                        logger.exception("Unexpected error analysing %s", label)

                if on_progress:
                    try:
                        on_progress(i + 1, total, label)
                    except Exception:
                        logger.warning("on_progress raised — continuing")
        finally:
            if engine_started:
                self.engine_manager.stop()

        return self._aggregate_results(results, username)

    def _aggregate_results(self, results: List[Dict[str, Any]], username: str) -> Dict[str, Any]:
        """Compiles individual game results into a summary report."""
        if not results:
            return {"username": username, "total_analyzed": 0, "summary": "No games were analyzed."}

        total_accuracy = 0
        quality_counts = {
            "Brilliant": 0,
            "Best": 0,
            "Excellent": 0,
            "Good": 0,
            "Book": 0,
            "Forced": 0,
            "Inaccuracy": 0,
            "Mistake": 0,
            "Blunder": 0,
        }
        phase_stats = {
            "opening": {"accuracy": 0, "moves": 0},
            "middlegame": {"accuracy": 0, "moves": 0},
            "endgame": {"accuracy": 0, "moves": 0}
        }
        
        for game in results:
            total_accuracy += game.get('game_accuracy', 0)
            for move in game.get('move_history', []):
                q = move.get('quality')
                if q in quality_counts:
                    quality_counts[q] += 1
                
                phase = move.get('phase')
                if phase in phase_stats:
                    phase_stats[phase]['accuracy'] += move.get('accuracy', 0)
                    phase_stats[phase]['moves'] += 1

        num_games = len(results)

        # Calculate averages for phases
        for phase in phase_stats:
            if phase_stats[phase]['moves'] > 0:
                phase_stats[phase]['avg_accuracy'] = round(phase_stats[phase]['accuracy'] / phase_stats[phase]['moves'], 2)
            else:
                phase_stats[phase]['avg_accuracy'] = 0

        # Aggregate time analysis across all games
        time_pressure_games = 0
        total_time_pressure_moves = 0
        phase_time_buckets: dict = {"opening": [], "middlegame": [], "endgame": []}
        games_with_time_data = 0
        for game in results:
            ta = game.get("time_analysis")
            if ta:
                games_with_time_data += 1
                if ta.get("time_pressure_risk"):
                    time_pressure_games += 1
                total_time_pressure_moves += ta.get("time_pressure_move_count", 0)
                for phase, avg in (ta.get("phase_time_breakdown") or {}).items():
                    if phase in phase_time_buckets and avg is not None:
                        phase_time_buckets[phase].append(avg)
        time_analysis_summary = {
            "games_with_time_data": games_with_time_data,
            "games_with_time_pressure": time_pressure_games,
            "time_pressure_pct": round(time_pressure_games / games_with_time_data * 100, 1) if games_with_time_data > 0 else 0,
            "avg_time_pressure_moves_per_game": round(total_time_pressure_moves / games_with_time_data, 1) if games_with_time_data > 0 else 0,
            "phase_avg_time": {
                phase: round(sum(times) / len(times), 2) if times else None
                for phase, times in phase_time_buckets.items()
            },
        }

        trends = self.trend_analyzer.calculate_trends(results)
        
        # Opening analysis
        repertoire    = self.opening_repertoire.analyze_repertoire(results)
        performance   = self.opening_performance.analyze_performance(results)
        mistakes      = self.opening_mistakes.analyze_mistakes(results)
        recommendations = self.opening_recommendations.get_recommendations(performance, mistakes)
        opp_losses    = self.opponent_opening_loss.analyze(results)
        
        # Pattern analysis
        patterns = self.pattern_aggregator.aggregate_batch_patterns(results)
        
        # Mistake analysis
        mistake_stats = self.mistake_frequency.aggregate_batch_frequency(results)

        return {
            "username": username,
            "total_analyzed": num_games,
            "average_accuracy": round(total_accuracy / num_games, 2) if num_games > 0 else 0,
            "move_quality_distribution": quality_counts,
            "phase_performance": {p: phase_stats[p]['avg_accuracy'] for p in phase_stats},
            "trends": trends,
            "openings": {
                "repertoire": repertoire,
                "performance": performance,
                "mistakes": mistakes,
                "recommendations": recommendations,
                "opponent_loss_analysis": opp_losses,
            },
            "patterns": patterns,
            "mistake_stats": mistake_stats,
            "time_analysis": time_analysis_summary,
            "individual_games": [
                {
                    "filename": g.get('filename'),
                    "accuracy": g.get('game_accuracy'),
                    "performance_rating": g.get('performance_rating'),
                    "result": g.get('metadata', {}).get('Result'),
                    "user_result": g.get('user_result', '?'),
                    "date": g.get('metadata', {}).get('Date'),
                    "opening": g.get('opening_name'),
                    "eco": g.get('eco_code'),
                    "white": g.get('white_player'),
                    "black": g.get('black_player'),
                    "white_rating": g.get('white_rating'),
                    "black_rating": g.get('black_rating'),
                    "user_color": g.get('user_color'),
                    # TimeClass is a Chess.com header ("rapid"/"blitz"/"bullet"/"daily")
                    # TimeControl is the raw seconds+increment string (e.g. "600+3")
                    "time_class":   (g.get('metadata', {}).get('TimeClass') or '').lower(),
                    "time_control": g.get('metadata', {}).get('TimeControl', ''),
                    # Full move-by-move data so consumers don't need to open cache files
                    "move_history": g.get('move_history', []),
                    # All moves (user + opponent) ordered by ply — lets the frontend
                    # reconstruct the FEN at any move number using chess.js.
                    "full_history": g.get('full_history', []),
                } for g in results
            ],
            # All moves across every game grouped by quality label
            "move_breakdown": self._build_move_breakdown(results),
        }

    @staticmethod
    def _build_move_breakdown(results: list) -> dict:
        """Return every user move grouped by quality, with game context attached."""
        order = ["Brilliant", "Best", "Excellent", "Good",
                 "Book", "Forced", "Inaccuracy", "Mistake", "Blunder"]
        breakdown: dict = {q: [] for q in order}

        for g in results:
            color = g.get('user_color', 'white')
            opp   = g.get('black_player') if color == 'white' else g.get('white_player')
            result = g.get('user_result', '?')
            game_label = f"vs {opp} ({result.upper()})"

            for m in g.get('move_history', []):
                quality = m.get('quality', '?')
                if quality not in breakdown:
                    breakdown[quality] = []
                breakdown[quality].append({
                    "game":          game_label,
                    "move_num":      m.get('move_num'),
                    "san":           m.get('san'),
                    "best_move":     m.get('best_move'),
                    "eval_before":   m.get('eval_before'),
                    "eval_after":    m.get('eval_after'),
                    "cp_loss":       m.get('cp_loss'),
                    "win_prob_drop": m.get('win_prob_drop'),
                    "accuracy":      m.get('accuracy'),
                    "phase":         m.get('phase'),
                    "error_nature":  m.get('error_nature'),
                })

        return breakdown
