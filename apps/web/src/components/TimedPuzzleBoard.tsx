"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import PuzzleBoard from "./PuzzleBoard";
import { Clock } from "lucide-react";

export type TimeLimit = 10 | 30 | 60;

type Puzzle = {
  puzzle_id:  string;
  fen:        string;
  best_move:  string;
  moves?:     string;
  theme:      string;
  difficulty: number;
  rating?:    number;
};

type Props = {
  puzzle:      Puzzle;
  puzzleIndex: number;
  totalPuzzles: number;
  timeLimit:   TimeLimit;
  onAttempt:   (solved: boolean, timeTaken: number, timedOut: boolean) => void;
  onNext:      () => void;
};

export default function TimedPuzzleBoard({
  puzzle, puzzleIndex, totalPuzzles, timeLimit, onAttempt, onNext,
}: Props) {
  const [timeLeft,        setTimeLeft]        = useState<number>(timeLimit);
  const [timedOut,        setTimedOut]        = useState(false);
  const [attempted,       setAttempted]       = useState(false);
  const [opponentPlaying, setOpponentPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const firedRef    = useRef(false);

  useEffect(() => {
    setTimeLeft(timeLimit);
    setTimedOut(false);
    setAttempted(false);
    setOpponentPlaying(false);
    firedRef.current = false;
  }, [puzzle.puzzle_id, timeLimit]);

  // Countdown — pauses while the opponent animation plays
  useEffect(() => {
    if (attempted || timedOut || opponentPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(intervalRef.current!);
          if (!firedRef.current) {
            firedRef.current = true;
            setTimedOut(true);
            setAttempted(true);
            onAttempt(false, timeLimit, true);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [attempted, timedOut, opponentPlaying, timeLimit, onAttempt]);

  const handleAttempt = useCallback(
    (solved: boolean, timeTaken: number) => {
      if (firedRef.current) return;
      firedRef.current = true;
      setAttempted(true);
      if (intervalRef.current) clearInterval(intervalRef.current);
      onAttempt(solved, timeTaken, false);
    },
    [onAttempt],
  );

  const firstMove = puzzle.moves ? puzzle.moves.split(" ")[0] : puzzle.best_move;
  const pct = (timeLeft / timeLimit) * 100;
  const barColor =
    pct > 50 ? "var(--success)" :
    pct > 20 ? "var(--warning)" :
    "var(--danger)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

      {/* Timer bar */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: barColor }}>
            <Clock size={14} />
            <span style={{ fontWeight: 700, fontSize: "14px", fontVariantNumeric: "tabular-nums" }}>
              {timeLeft}s
            </span>
            {opponentPlaying && (
              <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontStyle: "italic" }}>
                (paused)
              </span>
            )}
          </div>
          <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{timeLimit}s limit</span>
        </div>
        <div style={{ height: "6px", borderRadius: "3px", background: "var(--border-color)", overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${pct}%`, background: barColor, borderRadius: "3px",
            transition: opponentPlaying ? "none" : "width 1s linear, background 0.3s",
          }} />
        </div>
      </div>

      {/* Timeout message */}
      {timedOut && (
        <div style={{
          padding: "14px 18px", borderRadius: "10px",
          background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ color: "var(--danger)", fontWeight: 700, fontSize: "14px" }}>
            Time's up! Best move was {firstMove}
          </span>
          <button
            onClick={onNext}
            style={{
              padding: "8px 18px", borderRadius: "8px", cursor: "pointer",
              background: "var(--accent-color)", color: "#fff",
              border: "none", fontWeight: 700, fontSize: "13px",
            }}
          >
            Next →
          </button>
        </div>
      )}

      {/* Board — hidden after timeout so no stray interaction */}
      {!timedOut && (
        <PuzzleBoard
          key={puzzle.puzzle_id}
          puzzle={puzzle}
          puzzleIndex={puzzleIndex}
          totalPuzzles={totalPuzzles}
          onAttempt={handleAttempt}
          onNext={onNext}
          onOpponentPlaying={setOpponentPlaying}
        />
      )}
    </div>
  );
}
