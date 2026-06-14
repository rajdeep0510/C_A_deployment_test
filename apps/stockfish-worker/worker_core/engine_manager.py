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

class EngineManager:
    def __init__(self, stockfish_path: str = None, analysis_nodes: int = None):
        # Priority: explicit argument > central config > auto-discovery.
        # Always validate the resolved path — fall back to _find_stockfish() if
        # the configured value doesn't point to a real executable.
        candidate = stockfish_path or _default_stockfish()
        self.stockfish_path = candidate if self._path_is_valid(candidate) else self._find_stockfish()
        self.analysis_nodes = analysis_nodes if analysis_nodes is not None else _default_analysis_nodes()
        self.engine = None

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
        
        # Only add Windows paths if NOT on Linux
        if not is_linux:
            possible_paths.extend([
                "bin/stockfish/stockfish-windows-x86-64-avx2.exe",
                "bin/stockfish/stockfish.exe",
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

        limit = chess.engine.Limit(nodes=self.analysis_nodes)
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
