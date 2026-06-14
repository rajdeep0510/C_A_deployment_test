import chess
from typing import Optional
from utils.position_utils import PositionUtils

_PIECE_VALUES = {
    chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3,
    chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 0,
}


class TacticalValidator:
    """Detects human-readable tactical reasons for blunders and mistakes."""

    @staticmethod
    def validate_move(
        board_before: chess.Board,
        user_move: chess.Move,
        best_move: chess.Move,
        cp_loss: int,
        phase: str,
    ) -> Optional[str]:
        if cp_loss < 100:
            return None

        # Ordered by specificity / severity

        if TacticalValidator.is_hanging_piece_error(board_before, user_move):
            return "Hanging Piece"

        if TacticalValidator.is_missed_fork(board_before, user_move, best_move):
            return "Missed Fork"

        if TacticalValidator.is_missed_back_rank_mate(board_before, user_move, best_move):
            return "Missed Back Rank Mate"

        if TacticalValidator.is_missed_pin(board_before, best_move):
            return "Missed Pin"

        if TacticalValidator.is_missed_skewer(board_before, best_move):
            return "Missed Skewer"

        if TacticalValidator.is_missed_discovered_attack(board_before, user_move, best_move):
            return "Missed Discovered Attack"

        if phase == 'endgame' and cp_loss > 200:
            if TacticalValidator.is_promotion_error(board_before, user_move):
                return "Promotion Error"

        return None

    # ------------------------------------------------------------------
    # Hanging piece
    # ------------------------------------------------------------------
    @staticmethod
    def is_hanging_piece_error(board: chess.Board, move: chess.Move) -> bool:
        color = board.turn
        for square in chess.SQUARES:
            piece = board.piece_at(square)
            if not (piece and piece.color == color):
                continue
            if not PositionUtils.is_hanging(board, square):
                continue
            # Did this move address the hanging piece?
            temp = board.copy()
            temp.push(move)
            if move.from_square == square:
                if PositionUtils.is_hanging(temp, move.to_square):
                    return True  # moved it but still hanging
                continue
            new_piece = temp.piece_at(square)
            if new_piece and new_piece.color == color and PositionUtils.is_hanging(temp, square):
                return True

        # Did the move itself hang a piece?
        temp = board.copy()
        temp.push(move)
        if PositionUtils.is_hanging(temp, move.to_square):
            return True

        return False

    # ------------------------------------------------------------------
    # Missed fork
    # ------------------------------------------------------------------
    @staticmethod
    def is_missed_fork(board: chess.Board, user_move: chess.Move, best_move: chess.Move) -> bool:
        if not best_move:
            return False
        temp_best = board.copy()
        temp_best.push(best_move)
        if TacticalValidator._count_fork_targets(temp_best, best_move.to_square) >= 2:
            temp_user = board.copy()
            temp_user.push(user_move)
            if TacticalValidator._count_fork_targets(temp_user, user_move.to_square) < 2:
                return True
        return False

    @staticmethod
    def _count_fork_targets(board: chess.Board, square: chess.Square) -> int:
        piece = board.piece_at(square)
        if not piece:
            return 0
        targets = 0
        opponent_color = not piece.color
        for tgt in board.attacks(square):
            tgt_piece = board.piece_at(tgt)
            if tgt_piece and tgt_piece.color == opponent_color:
                if _PIECE_VALUES.get(tgt_piece.piece_type, 0) > _PIECE_VALUES.get(piece.piece_type, 0):
                    targets += 1
                elif not board.attackers(opponent_color, tgt):
                    targets += 1
        return targets

    # ------------------------------------------------------------------
    # Missed back-rank mate
    # ------------------------------------------------------------------
    @staticmethod
    def is_missed_back_rank_mate(
        board: chess.Board, user_move: chess.Move, best_move: chess.Move
    ) -> bool:
        if not best_move:
            return False
        temp = board.copy()
        temp.push(best_move)
        if temp.is_checkmate():
            return True
        # Check if best move gives check via back rank
        opponent_color = not board.turn
        opp_king_sq = temp.king(opponent_color)
        if opp_king_sq is None:
            return False
        back_rank = 0 if opponent_color == chess.WHITE else 7
        if chess.square_rank(opp_king_sq) == back_rank and temp.is_check():
            # User's move did NOT give check
            temp2 = board.copy()
            temp2.push(user_move)
            if not temp2.is_check():
                return True
        return False

    # ------------------------------------------------------------------
    # Missed pin
    # ------------------------------------------------------------------
    @staticmethod
    def is_missed_pin(board: chess.Board, best_move: chess.Move) -> bool:
        if not best_move:
            return False
        moved_piece = board.piece_at(best_move.from_square)
        if not moved_piece or moved_piece.piece_type not in (chess.BISHOP, chess.ROOK, chess.QUEEN):
            return False
        temp = board.copy()
        temp.push(best_move)
        opponent_color = not moved_piece.color
        opp_king_sq = temp.king(opponent_color)
        if opp_king_sq is None:
            return False
        # Check if any opponent piece is now pinned (absolute pin to king)
        for sq in chess.SQUARES:
            piece = temp.piece_at(sq)
            if piece and piece.color == opponent_color and piece.piece_type != chess.KING:
                if temp.is_pinned(opponent_color, sq):
                    return True
        return False

    # ------------------------------------------------------------------
    # Missed skewer
    # ------------------------------------------------------------------
    @staticmethod
    def is_missed_skewer(board: chess.Board, best_move: chess.Move) -> bool:
        if not best_move:
            return False
        moved_piece = board.piece_at(best_move.from_square)
        if not moved_piece or moved_piece.piece_type not in (chess.BISHOP, chess.ROOK, chess.QUEEN):
            return False
        temp = board.copy()
        temp.push(best_move)
        opponent_color = not moved_piece.color
        attacks = temp.attacks(best_move.to_square)
        for attacked_sq in attacks:
            front_piece = temp.piece_at(attacked_sq)
            if not (front_piece and front_piece.color == opponent_color):
                continue
            # There must be a less-valuable piece behind it on the same ray
            direction = _ray_direction(best_move.to_square, attacked_sq)
            if direction is None:
                continue
            behind_sq = attacked_sq + direction
            while 0 <= behind_sq < 64:
                behind_piece = temp.piece_at(behind_sq)
                if behind_piece:
                    if (behind_piece.color == opponent_color and
                            _PIECE_VALUES.get(behind_piece.piece_type, 0) <
                            _PIECE_VALUES.get(front_piece.piece_type, 0)):
                        return True
                    break
                if not _same_ray(best_move.to_square, attacked_sq, behind_sq):
                    break
                behind_sq += direction
        return False

    # ------------------------------------------------------------------
    # Missed discovered attack
    # ------------------------------------------------------------------
    @staticmethod
    def is_missed_discovered_attack(
        board: chess.Board, user_move: chess.Move, best_move: chess.Move
    ) -> bool:
        if not best_move:
            return False
        # A discovered attack occurs when the piece that moves uncovers an attack from a piece behind it.
        temp_best = board.copy()
        temp_best.push(best_move)
        color = board.turn
        opponent_color = not color
        # Check if any of our sliding pieces now attacks a valuable opponent piece
        # that it didn't before (because best_move cleared the line)
        new_attacks = set()
        old_attacks = set()
        for sq in chess.SQUARES:
            piece = board.piece_at(sq)
            if piece and piece.color == color and piece.piece_type in (chess.BISHOP, chess.ROOK, chess.QUEEN):
                if sq != best_move.from_square:
                    old_attacks.update(board.attacks(sq))
        for sq in chess.SQUARES:
            piece = temp_best.piece_at(sq)
            if piece and piece.color == color and piece.piece_type in (chess.BISHOP, chess.ROOK, chess.QUEEN):
                if sq != best_move.to_square:
                    new_attacks.update(temp_best.attacks(sq))
        # Newly attacked squares with valuable opponent pieces
        gained = new_attacks - old_attacks
        for sq in gained:
            p = temp_best.piece_at(sq)
            if p and p.color == opponent_color and _PIECE_VALUES.get(p.piece_type, 0) >= 3:
                return True
        return False

    # ------------------------------------------------------------------
    # Promotion error
    # ------------------------------------------------------------------
    @staticmethod
    def is_promotion_error(board: chess.Board, move: chess.Move) -> bool:
        color = board.turn
        promo_rank = 6 if color == chess.WHITE else 1
        pawns_on_7th = [sq for sq in board.pieces(chess.PAWN, color)
                        if chess.square_rank(sq) == promo_rank]
        if not pawns_on_7th:
            return False
        if move.promotion:
            return False
        return True


# ------------------------------------------------------------------
# Ray geometry helpers
# ------------------------------------------------------------------

def _ray_direction(from_sq: int, to_sq: int) -> Optional[int]:
    """Return the unit step from from_sq towards to_sq (same rank/file/diagonal), or None."""
    fr, ff = divmod(from_sq, 8)
    tr, tf = divmod(to_sq, 8)
    dr, df = tr - fr, tf - ff
    if dr == 0 and df == 0:
        return None
    if dr == 0:
        return 1 if df > 0 else -1
    if df == 0:
        return 8 if dr > 0 else -8
    if abs(dr) == abs(df):
        step_r = 1 if dr > 0 else -1
        step_f = 1 if df > 0 else -1
        return step_r * 8 + step_f
    return None


def _same_ray(origin: int, through: int, candidate: int) -> bool:
    """True if candidate is on the same ray from origin passing through `through`."""
    d1 = _ray_direction(origin, through)
    d2 = _ray_direction(through, candidate)
    return d1 is not None and d1 == d2
