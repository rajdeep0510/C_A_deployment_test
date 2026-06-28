from typing import Any, Dict, List
from collections import Counter


class OpeningRepertoire:
    """Summarises which openings a player uses across multiple games."""

    def analyze_repertoire(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        openings = [g.get("opening_name") or "Unknown" for g in results]
        eco      = [g.get("eco_code")     or "?"       for g in results]

        freq = Counter(openings)
        return {
            "most_played": freq.most_common(5),
            "unique_openings": len(freq),
            "eco_distribution": dict(Counter(eco).most_common(5)),
        }
