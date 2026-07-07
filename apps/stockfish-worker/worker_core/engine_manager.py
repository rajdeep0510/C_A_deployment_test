import shutil
import chess.engine
import os
from pathlib import Path
from typing import Dict, Any, Optional

# Import lazily-resolved to avoid circular imports at package init
def _default_stockfish() -> str:
    from worker_config import settings
    return settings.STOCKFISH_PATH

def _default_analysis_nodes() -> int:
    from worker_config import settings
    return settings.ANALYSIS_NODES

def _default_batch_analysis_time() -> float:
    from worker_config import settings
    return settings.BATCH_ANALYSIS_TIME

# Root of the stockfish-worker package (one level up from worker_core/)
_WORKER_ROOT = Path(__file__).parent.parent


class EngineManager:
    def __init__(
        self,
        stockfish_path: str = None,
        analysis_nodes: int = None,
        batch_mode: bool = False,
        batch_analysis_time: float = None,
    ):
        candidate = stockfish_path or _default_stockfish()
        resolved  = self._resolve(candidate)
        self.stockfish_path = resolved if resolved else self._find_stockfish()
        self.analysis_nodes = analysis_nodes if analysis_nodes is not None else _default_analysis_nodes()
        # Batch mode uses a time-based limit so simple/book positions finish fast
        # and only complex middlegame positions use the full budget.
        # Individual game analysis always uses the fixed node budget (unchanged).
        self.batch_mode = batch_mode
        self.batch_analysis_time = (
            batch_analysis_time if batch_analysis_time is not None
            else _default_batch_analysis_time()
        )
        self.engine = None

    @staticmethod
    def _resolve(path: str) -> "str | None":
        """
        Return an absolute path string for the given path, or None if not found.
        Tries (in order): system PATH (bare names only), absolute path, worker-root-relative path.
        """
        # shutil.which short-circuits on paths with directory separators and
        # returns the relative path as-is if the file is accessible from CWD.
        # Only use it for bare command names (e.g. 'stockfish' on Linux).
        if not os.path.split(path)[0]:
            which_result = shutil.which(path)
            if which_result:
                return which_result

        p = Path(path)
        if p.is_absolute() and p.exists():
            return str(p)

        # Resolve relative to the worker package root — always produces an
        # absolute path, so CreateProcess/asyncio can find it regardless of CWD.
        abs_candidate = (_WORKER_ROOT / path).resolve()
        if abs_candidate.exists():
            return str(abs_candidate)

        return None

    @staticmethod
    def _path_is_valid(path: str) -> bool:
        return bool(shutil.which(path) or Path(path).exists())

    def _find_stockfish(self) -> str:
        import platform
        is_linux = platform.system().lower() == "linux"
        
        # On Render/Linux, 'stockfish' should always be in the PATH after apt-get install.
        found = shutil.which("stockfish")
        if found:
            return found
            
        # Fallback list for local dev environments
        possible_paths = [
            "/opt/homebrew/bin/stockfish", # MacOS Homebrew
            "/usr/local/bin/stockfish",
            "/usr/bin/stockfish",
        ]
        
        # Only add Windows paths if NOT on Linux — resolved relative to worker root
        if not is_linux:
            possible_paths.extend([
                str(_WORKER_ROOT / "bin/stockfish/stockfish-windows-x86-64-avx2.exe"),
                str(_WORKER_ROOT / "bin/stockfish/stockfish.exe"),
            ])

        for path in possible_paths:
            if Path(path).is_file():
                return path
        return "stockfish"

    def start(self):
        if self.engine is None:
            self.engine = chess.engine.SimpleEngine.popen_uci(self.stockfish_path)

    def stop(self):
        if self.engine:
            self.engine.quit()
            self.engine = None

    def evaluate_position(self, board: chess.Board, multipv: int = 1, cache=None) -> Any:
        if cache is not None:
            import chess.polyglot
            cached = cache.get(chess.polyglot.zobrist_hash(board), multipv)
            if cached is not None:
                return cached

        limit = (
            chess.engine.Limit(time=self.batch_analysis_time)
            if self.batch_mode
            else chess.engine.Limit(nodes=self.analysis_nodes)
        )
        info = self.engine.analyse(board, limit, multipv=multipv)
        
        # When multipv=1, info is an InfoDict
        # When multipv > 1, info is a list of InfoDicts (usually)
        if multipv > 1:
            if not isinstance(info, list):
                info = [info]

            results = []
            for entry in info:
                score = entry['score'].relative
                eval_cp = score.score(mate_score=10000)
                move = entry.get('pv', [None])[0] if entry.get('pv') else None
                results.append({
                    "eval_cp": eval_cp,
                    "move": move,
                    "move_san": board.san(move) if move and move in board.legal_moves else "N/A"
                })
            if cache is not None:
                cache.put(chess.polyglot.zobrist_hash(board), multipv, results)
            return results
        else:
            # Single PV (explicitly requested)
            if isinstance(info, list):
                info = info[0]

            score = info['score'].relative
            eval_cp = score.score(mate_score=10000)
            best_move = info.get('pv', [None])[0] if info.get('pv') else None
            result = {
                "eval_cp": eval_cp,
                "best_move": best_move,
                "best_move_san": board.san(best_move) if best_move and best_move in board.legal_moves else "N/A"
            }
            if cache is not None:
                cache.put(chess.polyglot.zobrist_hash(board), multipv, result)
            return result
