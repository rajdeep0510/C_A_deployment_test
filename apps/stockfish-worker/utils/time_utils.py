from typing import Optional


def calculate_time_spent(last_clock: Optional[float], current_clock: Optional[float]) -> Optional[float]:
    """
    Returns seconds spent on a move given two consecutive clock readings.
    Returns None when clock data is unavailable (games without clock headers).
    """
    if last_clock is None or current_clock is None:
        return None
    return max(0.0, last_clock - current_clock)
