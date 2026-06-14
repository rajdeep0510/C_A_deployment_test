from typing import Dict, Any, Optional


def classify_move_quality(
    cp_loss: int,
    thresholds: Dict[str, Any],
    is_best_move: bool = False,
    is_only_move: bool = False,
    is_sacrifice: bool = False,
    win_prob_drop: float = 0.0,
) -> str:
    """
    Classify move quality using a dual gate: CP loss sets the error floor,
    win_prob_drop provides positional context.

    A Blunder requires both large CP loss AND meaningful win-probability damage.
    This prevents "+12 → +9" from being a Blunder (300 CP but ~1% win-prob drop),
    while still catching genuine errors in roughly equal positions.

    Priority: Forced → Brilliant → Best → Excellent → Good → Inaccuracy → Mistake → Blunder
    """
    if is_only_move:
        return "Forced"

    if is_best_move:
        if is_sacrifice:
            return "Brilliant"
        return "Best"

    blunder_cp    = thresholds.get('BLUNDER_THRESHOLD',        200)
    mistake_cp    = thresholds.get('MISTAKE_THRESHOLD',        100)
    inaccuracy_cp = thresholds.get('INACCURACY_THRESHOLD',      50)
    excellent_cp  = thresholds.get('EXCELLENT_MOVE_THRESHOLD',  10)

    blunder_wp    = thresholds.get('BLUNDER_WIN_PROB_DROP',     15)
    mistake_wp    = thresholds.get('MISTAKE_WIN_PROB_DROP',      7)
    inaccuracy_wp = thresholds.get('INACCURACY_WIN_PROB_DROP',   3)

    # Both gates must pass — CP loss confirms an error was made; win_prob_drop
    # confirms it actually mattered in this specific position.
    if cp_loss >= blunder_cp and win_prob_drop >= blunder_wp:
        return "Blunder"
    if cp_loss >= mistake_cp and win_prob_drop >= mistake_wp:
        return "Mistake"
    if cp_loss >= inaccuracy_cp and win_prob_drop >= inaccuracy_wp:
        return "Inaccuracy"
    if cp_loss >= excellent_cp:
        return "Good"
    return "Excellent"


def identify_error_nature(
    time_spent: Optional[float],
    cp_loss: int,
    phase: str = "unknown",
    win_prob_drop: float = 0.0,
) -> str:
    """Heuristically identify the reason for a bad move."""
    if cp_loss < 50:
        return "None"
    if time_spent is not None and time_spent < 5:
        return "Time Pressure"
    if phase == "opening" and cp_loss >= 100:
        return "Opening Knowledge"
    if phase == "endgame" and cp_loss >= 100:
        return "Endgame Technique"
    if cp_loss >= 200:
        return "Tactical Oversight"
    return "Positional Misjudgment"


class MoveClassifier:
    @staticmethod
    def classify(
        cp_loss: int,
        thresholds: Dict[str, Any],
        is_best_move: bool = False,
        is_only_move: bool = False,
        is_sacrifice: bool = False,
        win_prob_drop: float = 0.0,
    ) -> str:
        return classify_move_quality(
            cp_loss, thresholds,
            is_best_move=is_best_move,
            is_only_move=is_only_move,
            is_sacrifice=is_sacrifice,
            win_prob_drop=win_prob_drop,
        )

    @staticmethod
    def identify_nature(time_spent: Optional[float], cp_loss: int, phase: str = "unknown") -> str:
        return identify_error_nature(time_spent, cp_loss, phase)
