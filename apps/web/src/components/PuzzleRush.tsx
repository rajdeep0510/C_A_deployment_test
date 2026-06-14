"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Zap, X as XIcon, Trophy, Clock, ArrowLeft, RefreshCw } from "lucide-react";
import PuzzleBoard from "./PuzzleBoard";
import Loader from "./Loader";
import RushLeaderboard from "./RushLeaderboard";
import { getRushPuzzles, submitRushScore } from "@/services/api";

type RushPhase = "setup" | "loading" | "playing" | "ended";
type EndReason  = "time" | "strikes";

type Puzzle = {
  puzzle_id:  string;
  fen:        string;
  best_move:  string;
  moves?:     string;
  theme:      string;
  difficulty: number;
  rating?:    number;
  source?:    string;
};

const MAX_STRIKES = 3;

function extractPuzzle(item: any): Puzzle | null {
  if (!item) return null;
  const isLib = !item.puzzle_id;
  return {
    puzzle_id:  item.puzzle_id ?? item.id,
    fen:        item.fen,
    best_move:  item.moves ? item.moves.split(" ")[0] : (item.best_move ?? ""),
    moves:      item.moves || undefined,
    theme:      item.themes ?? item.theme ?? "",
    difficulty: item.difficulty ?? item.rating ?? 0,
    rating:     item.rating,
    source:     isLib ? "library" : "own_game",
  };
}

function getBest(d: number): number {
  try { return parseInt(localStorage.getItem(`rushBest_${d}`) ?? "0") || 0; }
  catch { return 0; }
}
function saveBest(d: number, score: number): void {
  try { localStorage.setItem(`rushBest_${d}`, String(score)); } catch { /* ignore */ }
}

function fmt(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function PuzzleRush({
  username, onExit,
}: { username: string; onExit: () => void }) {
  const [phase,     setPhase]     = useState<RushPhase>("setup");
  const [duration,  setDuration]  = useState<180 | 300>(180);
  const [puzzles,   setPuzzles]   = useState<Puzzle[]>([]);
  const [index,     setIndex]     = useState(0);
  const [score,     setScore]     = useState(0);
  const [strikes,   setStrikes]   = useState(0);
  const [wrong,     setWrong]     = useState(0);
  const [timeLeft,  setTimeLeft]  = useState(180);
  const [endReason, setEndReason] = useState<EndReason>("time");
  const [newBest,   setNewBest]   = useState(false);
  const [prevBest,  setPrevBest]  = useState(0);
  const [error,     setError]     = useState<string | null>(null);
  const [bests,     setBests]     = useState({ 180: 0, 300: 0 });

  // Refs to avoid stale closures in timer/callbacks
  const scoreRef    = useRef(0);
  const strikesRef  = useRef(0);
  const wrongRef    = useRef(0);
  const endedRef    = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setBests({ 180: getBest(180), 300: getBest(300) });
  }, []);

  function stopTimer() {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }

  function doEndRush(reason: EndReason) {
    if (endedRef.current) return;
    endedRef.current = true;
    stopTimer();
    const prev = getBest(duration);
    setPrevBest(prev);
    if (scoreRef.current > prev) {
      saveBest(duration, scoreRef.current);
      setBests(b => ({ ...b, [duration]: scoreRef.current }));
      setNewBest(true);
    }
    setEndReason(reason);
    setPhase("ended");

    // Submit score to backend (fire and forget — non-fatal)
    submitRushScore({
      username,
      score:            scoreRef.current,
      duration_seconds: duration,
      wrong_count:      wrongRef.current,
      end_reason:       reason,
    }).catch(() => {});
  }

  // Countdown — only runs while playing
  useEffect(() => {
    if (phase !== "playing") return;
    intervalRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(intervalRef.current!);
          doEndRush("time");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return stopTimer;
  }, [phase]);   // eslint-disable-line react-hooks/exhaustive-deps

  async function startRush() {
    setPhase("loading");
    setError(null);
    endedRef.current   = false;
    scoreRef.current   = 0;
    strikesRef.current = 0;
    wrongRef.current   = 0;
    try {
      const data = await getRushPuzzles(60);
      const raw = (data.puzzles || []).map(extractPuzzle).filter(Boolean) as Puzzle[];
      if (!raw.length) throw new Error("No puzzles available — check library seeding.");
      setPuzzles(raw);
      setIndex(0);
      setScore(0);
      setStrikes(0);
      setWrong(0);
      setNewBest(false);
      setTimeLeft(duration);
      setPhase("playing");
    } catch (e: any) {
      setError(e?.message ?? "Failed to load puzzles");
      setPhase("setup");
    }
  }

  const handleAttempt = useCallback((solved: boolean) => {
    if (solved) {
      scoreRef.current++;
      setScore(scoreRef.current);
    } else {
      strikesRef.current++;
      setStrikes(strikesRef.current);
      wrongRef.current++;
      setWrong(w => w + 1);
      if (strikesRef.current >= MAX_STRIKES) {
        setTimeout(() => doEndRush("strikes"), 900);
      }
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleNext = useCallback(() => {
    if (endedRef.current) return;
    setIndex(i => {
      const next = i + 1;
      if (next >= puzzles.length) { doEndRush("time"); return i; }
      return next;
    });
  }, [puzzles.length]);  // eslint-disable-line react-hooks/exhaustive-deps

  const puzzle   = puzzles[index] ?? null;
  const pct      = (timeLeft / duration) * 100;
  const barColor = pct > 50 ? "var(--success)" : pct > 20 ? "var(--warning)" : "var(--danger)";

  // ── Setup / Loading ────────────────────────────────────────────────────────
  if (phase === "setup" || phase === "loading") {
    return (
      <>
      <div className="glass-card" style={{ maxWidth: "460px", margin: "0 auto", padding: "44px 36px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "10px" }}>
          <Zap size={30} color="#f59e0b" fill="#f59e0b" />
          <h2 style={{ margin: 0, fontSize: "26px", fontWeight: 900 }}>Puzzle Rush</h2>
        </div>
        <p style={{ margin: "0 0 32px", color: "var(--text-secondary)", fontSize: "14px", lineHeight: 1.6 }}>
          Solve as many puzzles as you can before time runs out.<br />
          <strong>3 wrong answers = game over.</strong>
        </p>

        {error && (
          <div style={{
            marginBottom: "20px", padding: "10px 14px", borderRadius: "8px",
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
            color: "var(--danger)", fontSize: "13px",
          }}>{error}</div>
        )}

        {/* Duration picker */}
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginBottom: "28px" }}>
          {([180, 300] as const).map(d => (
            <button
              key={d}
              onClick={() => setDuration(d)}
              style={{
                padding: "14px 32px", borderRadius: "12px", cursor: "pointer",
                fontWeight: 800, fontSize: "16px",
                background: duration === d ? "#f59e0b" : "transparent",
                color:      duration === d ? "#fff" : "var(--text-secondary)",
                border:     `2px solid ${duration === d ? "#f59e0b" : "var(--border-color)"}`,
                transition: "all 0.15s",
              }}
            >
              {d === 180 ? "3 min" : "5 min"}
            </button>
          ))}
        </div>

        {/* Personal best */}
        <div style={{
          marginBottom: "32px", padding: "12px 20px", borderRadius: "10px",
          background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)",
          display: "inline-flex", alignItems: "center", gap: "8px",
        }}>
          <Trophy size={16} color="#f59e0b" />
          <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
            Best ({duration === 180 ? "3 min" : "5 min"}):&nbsp;
            <strong style={{ fontSize: "18px", color: "var(--text-primary)" }}>{bests[duration]}</strong>
          </span>
        </div>

        {phase === "loading" ? (
          <Loader message="Loading puzzles…" />
        ) : (
          <button
            onClick={startRush}
            style={{
              width: "100%", padding: "16px", borderRadius: "12px", cursor: "pointer",
              background: "#f59e0b", color: "#fff", border: "none",
              fontWeight: 800, fontSize: "16px",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            }}
          >
            <Zap size={18} fill="#fff" /> Start Rush
          </button>
        )}

        <button
          onClick={onExit}
          style={{
            marginTop: "16px", background: "none", border: "none",
            cursor: "pointer", color: "var(--text-secondary)", fontSize: "13px",
          }}
        >
          ← Back to Training
        </button>
      </div>

      {/* Compact leaderboard below setup card */}
      <div className="glass-card" style={{ maxWidth: "460px", margin: "12px auto 0", padding: "20px 24px" }}>
        <RushLeaderboard duration={duration} currentUsername={username} compact />
      </div>
      </>
    );
  }

  // ── Ended ──────────────────────────────────────────────────────────────────
  if (phase === "ended") {
    const timeUsed = duration - timeLeft;
    return (
      <div style={{ maxWidth: "960px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", alignItems: "start" }}>
      <div className="glass-card" style={{ padding: "44px 36px", textAlign: "center" }}>
        <div style={{ marginBottom: "18px" }}>
          {endReason === "strikes"
            ? <div style={{ fontSize: "52px" }}>💥</div>
            : <Clock size={52} color="var(--accent-color)" />}
        </div>

        <h2 style={{ margin: "0 0 6px", fontSize: "22px", fontWeight: 800 }}>
          {endReason === "strikes" ? "3 Strikes — Game Over!" : "Time's Up!"}
        </h2>
        <p style={{ margin: "0 0 28px", color: "var(--text-secondary)", fontSize: "14px" }}>
          {duration === 180 ? "3-minute" : "5-minute"} rush
        </p>

        {/* Big score */}
        <div style={{ marginBottom: "6px" }}>
          <div style={{ fontSize: "80px", fontWeight: 900, lineHeight: 1, color: "var(--accent-color)" }}>
            {score}
          </div>
          <div style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: "4px", fontWeight: 600 }}>
            puzzles solved
          </div>
        </div>

        {/* Personal best badge */}
        <div style={{
          margin: "18px auto 28px",
          padding: "10px 20px", borderRadius: "20px",
          background: newBest ? "rgba(245,158,11,0.12)" : "rgba(100,100,100,0.06)",
          border: `1px solid ${newBest ? "rgba(245,158,11,0.4)" : "var(--border-color)"}`,
          display: "inline-flex", alignItems: "center", gap: "8px",
        }}>
          <Trophy size={15} color={newBest ? "#f59e0b" : "var(--text-secondary)"} />
          <span style={{ fontSize: "14px", fontWeight: 700, color: newBest ? "#92400e" : "var(--text-secondary)" }}>
            {newBest ? `New best! (was ${prevBest})` : `Best: ${bests[duration]}`}
          </span>
        </div>

        {/* Stats row */}
        <div style={{
          display: "flex", justifyContent: "center", gap: "36px",
          marginBottom: "32px",
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "28px", fontWeight: 900, color: "var(--success)" }}>{score}</div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>Correct</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "28px", fontWeight: 900, color: "var(--danger)" }}>{wrong}</div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>Wrong</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "28px", fontWeight: 900 }}>{fmt(timeUsed)}</div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>Used</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <button
            onClick={startRush}
            style={{
              padding: "13px 28px", borderRadius: "10px", cursor: "pointer",
              background: "#f59e0b", color: "#fff", border: "none",
              fontWeight: 700, fontSize: "14px",
              display: "flex", alignItems: "center", gap: "6px",
            }}
          >
            <RefreshCw size={14} /> Play Again
          </button>
          <button
            onClick={onExit}
            style={{
              padding: "13px 24px", borderRadius: "10px", cursor: "pointer",
              background: "transparent", color: "var(--text-secondary)",
              border: "1px solid var(--border-color)", fontWeight: 600, fontSize: "14px",
              display: "flex", alignItems: "center", gap: "6px",
            }}
          >
            <ArrowLeft size={14} /> Back
          </button>
        </div>
      </div>

      {/* Leaderboard — right column */}
      <div className="glass-card" style={{ padding: "24px" }}>
        <RushLeaderboard duration={duration} currentUsername={username} />
      </div>
      </div>
    );
  }

  // ── Playing ────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: "600px" }}>

      {/* Stats bar */}
      <div className="glass-card" style={{
        padding: "12px 20px", marginBottom: "16px",
        display: "flex", alignItems: "center", gap: "14px",
      }}>
        {/* Countdown */}
        <div style={{
          display: "flex", alignItems: "center", gap: "6px",
          color: barColor, minWidth: "64px",
        }}>
          <Clock size={16} />
          <span style={{ fontWeight: 800, fontSize: "20px", fontVariantNumeric: "tabular-nums" }}>
            {fmt(timeLeft)}
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ flex: 1, height: "6px", borderRadius: "3px", background: "var(--border-color)", overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${pct}%`, background: barColor, borderRadius: "3px",
            transition: "width 1s linear, background 0.3s",
          }} />
        </div>

        {/* Score */}
        <div style={{ textAlign: "center", minWidth: "56px" }}>
          <div style={{ fontSize: "28px", fontWeight: 900, lineHeight: 1, color: "var(--accent-color)" }}>{score}</div>
          <div style={{ fontSize: "10px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>score</div>
        </div>

        {/* Strikes */}
        <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
          {Array.from({ length: MAX_STRIKES }).map((_, i) => (
            <div
              key={i}
              style={{
                width: "24px", height: "24px", borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: i < strikes ? "rgba(239,68,68,0.12)" : "rgba(0,0,0,0.08)",
                border: `2px solid ${i < strikes ? "var(--danger)" : "rgba(0,0,0,0.18)"}`,
                transition: "all 0.25s",
              }}
            >
              {i < strikes && <XIcon size={11} color="var(--danger)" strokeWidth={3} />}
            </div>
          ))}
        </div>
      </div>

      {/* Board */}
      {puzzle && (
        <div className="glass-card" style={{ padding: "24px" }}>
          <PuzzleBoard
            key={puzzle.puzzle_id}
            puzzle={puzzle}
            puzzleIndex={index}
            totalPuzzles={puzzles.length}
            onAttempt={(solved) => handleAttempt(solved)}
            onNext={handleNext}
            autoAdvance
          />
        </div>
      )}
    </div>
  );
}
