import os
import json
from typing import Dict, Any, Optional

# Increment this whenever the analysis pipeline changes output (new formula,
# different engine depth strategy, etc.).  Cached results with an older version
# are treated as stale and re-analyzed on the next request.
CURRENT_ANALYSIS_VERSION = 2

class AnalysisStorage:
    """Manages persistence of analysis results to the local filesystem."""
    
    def __init__(self, storage_dir: Optional[str] = None):
        if storage_dir is None:
            # Use data/analysis relative to backend root
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            self.storage_dir = os.path.join(base_dir, "data", "analysis")
        else:
            self.storage_dir = storage_dir
            
        os.makedirs(self.storage_dir, exist_ok=True)

    def save_analysis(self, username: str, filename: str, result: Dict[str, Any]) -> str:
        """Saves a single game analysis as JSON."""
        user_dir = os.path.join(self.storage_dir, username.lower())
        os.makedirs(user_dir, exist_ok=True)
        
        # Clean filename to be safe
        safe_name = filename.replace(".pgn", ".json")
        filepath = os.path.join(user_dir, safe_name)
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=4)
            
        return filepath

    def get_analysis(self, username: str, filename: str) -> Optional[Dict[str, Any]]:
        """Retrieves a saved analysis."""
        safe_name = filename.replace(".pgn", ".json")
        filepath = os.path.join(self.storage_dir, username.lower(), safe_name)

        if not os.path.exists(filepath):
            return None

        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError):
            # Corrupted cache — remove it so the game is re-analyzed on next request
            try:
                os.remove(filepath)
            except OSError:
                pass
            return None

        # Version check: results produced under an older pipeline are stale.
        # Returning None causes the caller to re-analyze and overwrite with a
        # fresh v{CURRENT_ANALYSIS_VERSION} result.
        if data.get("analysis_version", 1) < CURRENT_ANALYSIS_VERSION:
            return None

        return data

    def is_fresh(self, username: str, filename: str, pgn_mtime: float) -> bool:
        """Returns True if the cached analysis JSON is newer than the PGN source file."""
        safe_name = filename.replace(".pgn", ".json")
        filepath = os.path.join(self.storage_dir, username.lower(), safe_name)
        if not os.path.exists(filepath):
            return False
        return os.path.getmtime(filepath) >= pgn_mtime

    def save_batch_report(self, username: str, limit: int, report: dict) -> None:
        """Persists an aggregated batch report to disk."""
        user_dir = os.path.join(self.storage_dir, username.lower())
        os.makedirs(user_dir, exist_ok=True)
        filepath = os.path.join(user_dir, f"_batch_{limit}.json")
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(report, f)

    def save_batch_raw(self, username: str, limit: int, raw_results: list) -> None:
        """Persists raw per-game results so incremental updates avoid re-reading individual files."""
        user_dir = os.path.join(self.storage_dir, username.lower())
        os.makedirs(user_dir, exist_ok=True)
        filepath = os.path.join(user_dir, f"_raw_{limit}.json")
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(raw_results, f)

    def get_batch_raw(self, username: str, limit: int) -> Optional[list]:
        """Returns stored raw per-game results regardless of freshness, or None if missing/corrupted."""
        filepath = os.path.join(self.storage_dir, username.lower(), f"_raw_{limit}.json")
        if not os.path.exists(filepath):
            return None
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            try:
                os.remove(filepath)
            except OSError:
                pass
            return None

    def get_batch_report(self, username: str, limit: int, games_dir: str) -> Optional[Dict[str, Any]]:
        """Returns the cached batch report if no PGN file is newer than it, else None."""
        filepath = os.path.join(self.storage_dir, username.lower(), f"_batch_{limit}.json")
        if not os.path.exists(filepath):
            return None
        report_mtime = os.path.getmtime(filepath)
        try:
            for fname in os.listdir(games_dir):
                if fname.endswith(".pgn"):
                    if os.path.getmtime(os.path.join(games_dir, fname)) > report_mtime:
                        return None
        except OSError:
            return None
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            try:
                os.remove(filepath)
            except OSError:
                pass
            return None
