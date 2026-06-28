from typing import Dict, Optional
import chess

# Keyed by FEN (piece placement + active color only) for transposition-awareness.
# Covers the most common ECO openings students will encounter.
_OPENINGS: Dict[str, Dict[str, str]] = {
    # === Starting position book positions ===
    "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b": {"eco": "B00", "name": "King's Pawn Opening"},
    "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b": {"eco": "A40", "name": "Queen's Pawn Opening"},
    "rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b": {"eco": "A10", "name": "English Opening"},
    "rnbqkbnr/pppppppp/8/8/1P6/8/P1PPPPPP/RNBQKBNR b": {"eco": "A01", "name": "Nimzo-Larsen Attack"},
    # === Sicilian ===
    "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w": {"eco": "B20", "name": "Sicilian Defense"},
    "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b": {"eco": "B23", "name": "Sicilian Defense, Closed"},
    "rnbqkbnr/pp1ppppp/8/2p5/3PP3/8/PPP2PPP/RNBQKBNR b": {"eco": "B21", "name": "Sicilian Defense, Smith-Morra Gambit"},
    "r1bqkbnr/pp1ppppp/2n5/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w": {"eco": "B30", "name": "Sicilian Defense, Old Sicilian"},
    "rnbqkb1r/pp2pppp/3p1n2/2p5/3PP3/2N5/PPP2PPP/R1BQKBNR w": {"eco": "B56", "name": "Sicilian Defense, Classical"},
    "rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w": {"eco": "B90", "name": "Sicilian Defense, Najdorf"},
    # === French ===
    "rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w": {"eco": "C00", "name": "French Defense"},
    "rnbqkbnr/pppp1ppp/4p3/8/3PP3/8/PPP2PPP/RNBQKBNR b": {"eco": "C02", "name": "French Defense, Advance Variation"},
    "rnbqkbnr/pppp1ppp/4p3/8/4P3/2N5/PPPP1PPP/R1BQKBNR b": {"eco": "C15", "name": "French Defense, Winawer"},
    # === Caro-Kann ===
    "rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w": {"eco": "B10", "name": "Caro-Kann Defense"},
    "rnbqkbnr/pp1ppppp/2p5/8/3PP3/8/PPP2PPP/RNBQKBNR b": {"eco": "B12", "name": "Caro-Kann Defense, Advance"},
    # === Italian / Ruy Lopez ===
    "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w": {"eco": "C40", "name": "King's Knight Opening"},
    "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b": {"eco": "C60", "name": "Ruy Lopez"},
    "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w": {"eco": "C50", "name": "Italian Game"},
    "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R b": {"eco": "C55", "name": "Italian Game, Two Knights Defense"},
    "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b": {"eco": "C54", "name": "Italian Game, Giuoco Piano"},
    # === Queen's Gambit ===
    "rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w": {"eco": "D06", "name": "Queen's Gambit"},
    "rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b": {"eco": "D06", "name": "Queen's Gambit"},
    "rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/8/PP2PPPP/RNBQKBNR w": {"eco": "D30", "name": "Queen's Gambit Declined"},
    "rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR w": {"eco": "D04", "name": "Queen's Gambit, Chigorin Defense"},
    # === King's Indian ===
    "rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w": {"eco": "A46", "name": "Indian Game"},
    "rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR w": {"eco": "E60", "name": "King's Indian Defense"},
    "rnbqk2r/ppppppbp/5np1/8/2PPP3/2N5/PP3PPP/R1BQKBNR b": {"eco": "E70", "name": "King's Indian Defense, Averbakh"},
    # === Nimzo-Indian / Queen's Indian ===
    "rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N5/PP2PPPP/R1BQKBNR w": {"eco": "E20", "name": "Nimzo-Indian Defense"},
    "rnbqkb1r/p1pp1ppp/1p2pn2/8/2PP4/5N2/PP2PPPP/RNBQKB1R w": {"eco": "E12", "name": "Queen's Indian Defense"},
    # === Slav ===
    "rnbqkbnr/pp2pppp/2p5/3p4/2PP4/8/PP2PPPP/RNBQKBNR w": {"eco": "D10", "name": "Slav Defense"},
    # === Grünfeld ===
    "rnbqkb1r/ppp1pp1p/5np1/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w": {"eco": "D80", "name": "Grünfeld Defense"},
    # === Dutch ===
    "rnbqkbnr/ppppp1pp/8/5p2/3P4/8/PPP1PPPP/RNBQKBNR w": {"eco": "A80", "name": "Dutch Defense"},
    # === Pirc / Modern ===
    "rnbqkbnr/ppp1pppp/3p4/8/4P3/8/PPPP1PPP/RNBQKBNR w": {"eco": "B00", "name": "Pirc Defense"},
    # === London / Colle ===
    "rnbqkbnr/pppppppp/8/8/3P4/2N5/PPP1PPPP/R1BQKBNR b": {"eco": "A46", "name": "Indian Game, Knights Variation"},
    "rnbqkb1r/pppppppp/5n2/8/3P4/2N5/PPP1PPPP/R1BQKBNR b": {"eco": "A46", "name": "London System"},
}

# Zobrist-style position key: python-chess board.fen() stripped to piece placement + side
def _pos_key(board: chess.Board) -> str:
    fen = board.fen()
    parts = fen.split()
    return f"{parts[0]} {parts[1]}"

# Book positions (Zobrist keys) — any position in the opening table qualifies
_BOOK_KEYS = set(_OPENINGS.keys())


class OpeningDB:
    """Lightweight opening classification using a hardcoded ECO table."""

    @staticmethod
    def get_opening_by_position(board: chess.Board) -> Optional[Dict[str, str]]:
        return _OPENINGS.get(_pos_key(board))

    @staticmethod
    def is_book_position(board: chess.Board) -> bool:
        return _pos_key(board) in _BOOK_KEYS
