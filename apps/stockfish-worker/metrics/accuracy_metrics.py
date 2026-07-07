import math


def _win_prob(cp: float) -> float:
    """Convert centipawn evaluation to win probability (0-100). Lichess sigmoid formula."""
    return 50 + 50 * (2 / (1 + math.exp(-0.00368208 * cp)) - 1)


def calculate_centipawn_loss(eval_before: float, eval_after: float, side: str) -> float:
    """
    CP loss from the moving player's perspective.
    eval_before / eval_after are always white-centric (positive = white better).
    side is 'white' or 'black' — whichever player just moved.
    """
    if side == "white":
        return max(0.0, eval_before - eval_after)
    else:
        return max(0.0, eval_after - eval_before)


def win_prob_from_cp(cp: float) -> float:
    """Win probability (0–100) from a centipawn evaluation (user-centric, positive = user better)."""
    return _win_prob(cp)


def calculate_win_prob_drop(user_cp_before: float, user_cp_after: float) -> float:
    """
    Win-probability drop from the user's perspective (0-100 scale).
    Both inputs must already be in the user's frame (positive = user better).
    """
    return max(0.0, _win_prob(user_cp_before) - _win_prob(user_cp_after))


def calculate_move_accuracy(user_cp_before: float, user_cp_after: float) -> float:
    """
    Per-move accuracy (0-100) using the Lichess exponential formula.
    Mirrors the formula used in the WASM frontend path (local-analysis.ts).
    """
    win_diff = calculate_win_prob_drop(user_cp_before, user_cp_after)
    raw = 103.1668100711649 * math.exp(-0.04354415386753951 * abs(win_diff)) - 3.166924740191411
    return min(100.0, max(0.0, raw + 1))
