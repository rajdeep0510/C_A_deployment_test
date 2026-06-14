"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Loader from "@/components/Loader";
import PuzzleBoard from "@/components/PuzzleBoard";
import TimedPuzzleBoard from "@/components/TimedPuzzleBoard";
import TimeChallengeSetup from "@/components/TimeChallengeSetup";
import SessionSummary from "@/components/SessionSummary";
import PuzzleRadar from "@/components/PuzzleRadar";
import PuzzleRush from "@/components/PuzzleRush";
import { usePlayer } from "@/contexts/PlayerContext";
import {
  getPuzzleQueue, generatePuzzles, recordPuzzleAttempt,
  getPuzzleStats, getLibraryPuzzles,
} from "@/services/api";
import { Heart, Trophy, RefreshCw, Zap, Clock, BookOpen, Swords } from "lucide-react";
import type { TimeLimit } from "@/components/TimedPuzzleBoard";

// ── Types ─────────────────────────────────────────────────────────────────────
type Puzzle = {
  puzzle_id: string; fen: string; best_move: string; moves?: string;
  theme: string; difficulty: number; phase?: string; rating?: number;
  source?: string;
};
type Mode = "normal" | "survival" | "time" | "rush";
type Phase = "all" | "opening" | "middlegame" | "endgame";
type Source = "own" | "library";

const MAX_LIVES = 3;
const PHASE_TABS: { value: Phase; label: string }[] = [
  { value: "all",        label: "All"        },
  { value: "opening",    label: "Opening"    },
  { value: "middlegame", label: "Middlegame" },
  { value: "endgame",    label: "Endgame"    },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function extractPuzzle(item: any): Puzzle | null {
  const p = item?.puzzles ?? item?.puzzle_library ?? item;
  if (!p?.puzzle_id && !p?.id) return null;
  const isLibrary = !p.puzzle_id;
  return {
    puzzle_id:  p.puzzle_id ?? p.id,
    fen:        p.fen,
    best_move:  p.moves ? p.moves.split(" ")[0] : p.best_move,
    moves:      p.moves || undefined,
    theme:      p.themes ?? p.theme ?? "",
    difficulty: p.difficulty ?? p.rating ?? 0,
    phase:      p.phase,
    rating:     p.rating,
    source:     isLibrary ? "library" : "own_game",
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PuzzlesPage() {
  const router = useRouter();
  const { chessUsername, isApproved, loading: playerLoading } = usePlayer();

  // Puzzle data
  const [puzzles, setPuzzles]           = useState<Puzzle[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading]           = useState(true);
  const [generating, setGenerating]     = useState(false);
  const [stats, setStats]               = useState<any>(null);

  // Filters
  const [phase, setPhase]   = useState<Phase>("all");
  const [source, setSource] = useState<Source>("own");

  // Mode
  const [mode, setMode]           = useState<Mode>("normal");
  const [timeLimit, setTimeLimit] = useState<TimeLimit>(30);
  const [showTimeSetup, setShowTimeSetup] = useState(false);

  // Survival state
  const [lives, setLives] = useState(MAX_LIVES);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  // Session tracking (for summary)
  const [sessionSolved, setSessionSolved] = useState(0);
  const [sessionTotal, setSessionTotal]   = useState(0);
  const [sessionTimes, setSessionTimes]   = useState<number[]>([]);
  const [showSummary, setShowSummary]     = useState(false);
  const [loadError, setLoadError]         = useState<string | null>(null);
  const [ratingDelta, setRatingDelta]     = useState<number | null>(null);
  const [streakDays, setStreakDays]       = useState(0);
  const [showCalibration, setShowCalibration] = useState(false);

  // ── Data loading ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (playerLoading) return;
    if (!chessUsername || !isApproved) { router.replace("/login"); return; }
    loadPuzzles();
    loadStats();
    loadRating();
  }, [playerLoading, chessUsername, isApproved]);

  useEffect(() => {
    if (!chessUsername || !isApproved || playerLoading) return;
    loadPuzzles();
  }, [phase, source]);

  async function loadPuzzles() {
    setLoading(true);
    setLoadError(null);
    setCurrentIndex(0);
    try {
      let raw: Puzzle[] = [];
      if (source === "own") {
        const phaseParam = phase !== "all" ? phase : undefined;
        const data = await getPuzzleQueue(chessUsername!, 20, phaseParam);
        raw = (data.queue || []).map(extractPuzzle).filter(Boolean) as Puzzle[];
      } else {
        const phaseParam = phase !== "all" ? phase : undefined;
        const data = await getLibraryPuzzles(undefined, phaseParam, 800, 2500, 20);
        raw = (data.puzzles || []).map(extractPuzzle).filter(Boolean) as Puzzle[];
      }
      setPuzzles(raw);
    } catch (e: any) {
      setLoadError(e?.message ?? "Failed to load puzzles — is the backend running?");
      setPuzzles([]);
    }
    finally { setLoading(false); }
  }

  async function loadStats() {
    try {
      const s = await getPuzzleStats(chessUsername!);
      setStats(s);
      if (s?.streak_days) setStreakDays(s.streak_days);
    } catch { setStats(null); }
  }

  async function loadRating() {
    try {
      const { getPlayerRating } = await import("@/services/api");
      const r = await getPlayerRating(chessUsername!);
      if (r && !r.calibrated) setShowCalibration(true);
    } catch { /* non-fatal */ }
  }

  async function handleGenerate() {
    setGenerating(true);
    try { await generatePuzzles(chessUsername!); await loadPuzzles(); await loadStats(); }
    finally { setGenerating(false); }
  }

  // ── Attempt handler ───────────────────────────────────────────────────────
  const handleAttempt = useCallback(async (
    solved: boolean,
    timeTaken: number,
    timedOut = false,
  ) => {
    if (!chessUsername || !puzzles[currentIndex]) return;
    const puzzle = puzzles[currentIndex];

    setSessionTotal((t) => t + 1);
    setSessionTimes((ts) => [...ts, timeTaken]);
    if (solved) setSessionSolved((s) => s + 1);
    setRatingDelta(null);

    try {
      const result = await recordPuzzleAttempt(
        chessUsername,
        puzzle.puzzle_id,
        solved,
        timeTaken,
        puzzle.rating,
        (puzzle.source ?? "own_game") as "own_game" | "library",
      );
      if (result?.rating_delta != null) setRatingDelta(result.rating_delta);
      if (result?.streak_days)          setStreakDays(result.streak_days);
    } catch { /* non-fatal */ }

    if (mode === "survival") {
      if (solved) { setScore((s) => s + 1); }
      else {
        const nl = lives - 1;
        setLives(nl);
        if (nl <= 0) setGameOver(true);
      }
    }
  }, [chessUsername, puzzles, currentIndex, mode, lives]);

  // ── Navigation ────────────────────────────────────────────────────────────
  function handleNext() {
    if (mode === "survival" && gameOver) return;
    const next = currentIndex + 1;
    if (next >= puzzles.length) {
      if (mode === "time" || mode === "survival") {
        setShowSummary(true);
      } else {
        loadPuzzles();
      }
    } else {
      setCurrentIndex(next);
    }
  }

  // ── Mode controls ─────────────────────────────────────────────────────────
  function startSurvival() {
    setMode("survival"); setLives(MAX_LIVES); setScore(0);
    setGameOver(false); resetSession(); setCurrentIndex(0);
  }
  function startTime(limit: TimeLimit) {
    setTimeLimit(limit); setMode("time");
    setShowTimeSetup(false); resetSession(); setCurrentIndex(0);
  }
  function exitMode() {
    setMode("normal"); setGameOver(false); setLives(MAX_LIVES);
    setScore(0); setShowSummary(false); resetSession(); setCurrentIndex(0);
  }
  function resetSession() {
    setSessionSolved(0); setSessionTotal(0); setSessionTimes([]);
  }

  const avgTime = sessionTimes.length > 0
    ? sessionTimes.reduce((a, b) => a + b, 0) / sessionTimes.length : 0;

  // ── Render ────────────────────────────────────────────────────────────────
  if (playerLoading) return <div style={{ minHeight: "100vh", background: "var(--bg-color)" }}><Header /><Loader /></div>;

  // Rush mode takes over the whole page
  if (mode === "rush") {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-color)" }}>
        <Header />
        <div className="container" style={{ paddingTop: "32px", paddingBottom: "48px" }}>
          <PuzzleRush username={chessUsername!} onExit={() => setMode("normal")} />
        </div>
      </div>
    );
  }

  const puzzle = puzzles[currentIndex] ?? null;
  const isActiveMode = mode !== "normal";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-color)" }}>
      <Header />

      {/* Modals */}
      {showTimeSetup && (
        <TimeChallengeSetup
          onStart={startTime}
          onCancel={() => setShowTimeSetup(false)}
        />
      )}
      {showSummary && (
        <SessionSummary
          solved={sessionSolved}
          total={sessionTotal}
          avgTimeSecs={avgTime}
          mode={mode === "time" ? `Time Challenge (${timeLimit}s)` : "Survival"}
          onRestart={() => { setShowSummary(false); mode === "survival" ? startSurvival() : startTime(timeLimit); }}
          onExit={exitMode}
        />
      )}

      <div className="container" style={{ paddingTop: "32px", paddingBottom: "48px" }}>

        {/* ── Page header ── */}
        <div className="flex-between" style={{ marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 800 }}>Puzzle Training</h1>
            <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "14px" }}>
              Sharpen your tactics — from your own games and the Lichess library
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {!isActiveMode ? (
              <>
                <button onClick={() => setMode("rush")} style={modeBtn("#f59e0b")}>
                  <Zap size={13} /> Puzzle Rush
                </button>
                <button onClick={startSurvival} style={modeBtn("#ef4444")}>
                  <Heart size={13} /> Survival
                </button>
                <button onClick={() => setShowTimeSetup(true)} style={modeBtn("var(--warning)")}>
                  <Clock size={13} /> Time Challenge
                </button>
                <button onClick={handleGenerate} disabled={generating} style={genBtn(generating)}>
                  <RefreshCw size={13} style={{ animation: generating ? "spin 1s linear infinite" : "none" }} />
                  {generating ? "Generating…" : "Regenerate"}
                </button>
              </>
            ) : (
              <button onClick={exitMode} style={{
                padding: "8px 16px", borderRadius: "8px", cursor: "pointer",
                background: "transparent", color: "var(--text-secondary)",
                border: "1px solid var(--border-color)", fontWeight: 600, fontSize: "13px",
              }}>
                ← Exit {mode === "survival" ? "Survival" : "Time Challenge"}
              </button>
            )}
          </div>
        </div>

        {/* ── Calibration banner ── */}
        {showCalibration && !isActiveMode && (
          <div style={{
            marginBottom: "12px", padding: "14px 18px", borderRadius: "10px",
            background: "rgba(29,193,137,0.08)", border: "1px solid rgba(29,193,137,0.25)",
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px",
          }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: "14px" }}>Set your puzzle rating</p>
              <p style={{ margin: "2px 0 0", color: "var(--text-secondary)", fontSize: "13px" }}>
                Solve 10 quick puzzles so we can serve the right difficulty for you.
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => setShowCalibration(false)}
                style={{ padding: "8px 14px", borderRadius: "8px", cursor: "pointer", background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-color)", fontSize: "13px" }}
              >
                Skip
              </button>
              <button
                onClick={() => { /* TODO Phase 2: open CalibrationFlow */ setShowCalibration(false); }}
                style={{ padding: "8px 16px", borderRadius: "8px", cursor: "pointer", background: "var(--accent-color)", color: "#fff", border: "none", fontWeight: 700, fontSize: "13px" }}
              >
                Start Calibration →
              </button>
            </div>
          </div>
        )}

        {/* ── Streak badge ── */}
        {streakDays > 0 && !isActiveMode && (
          <div style={{ marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "16px" }}>🔥</span>
            <span style={{ fontWeight: 700, fontSize: "14px" }}>{streakDays}-day streak</span>
          </div>
        )}

        {/* ── Source + phase filters (hidden during active mode) ── */}
        {!isActiveMode && (
          <div style={{ marginBottom: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* Source toggle */}
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setSource("own")} style={sourceBtn(source === "own")}>
                <Swords size={13} /> Your Missed Opportunities
              </button>
              <button onClick={() => setSource("library")} style={sourceBtn(source === "library")}>
                <BookOpen size={13} /> Lichess Library
              </button>
            </div>
            {/* Phase tabs */}
            <div style={{ display: "flex", gap: "6px" }}>
              {PHASE_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setPhase(tab.value)}
                  style={{
                    padding: "6px 16px", borderRadius: "20px", cursor: "pointer",
                    fontSize: "13px", fontWeight: 600,
                    background: phase === tab.value ? "var(--accent-color)" : "transparent",
                    color: phase === tab.value ? "#fff" : "var(--text-secondary)",
                    border: `1px solid ${phase === tab.value ? "var(--accent-color)" : "var(--border-color)"}`,
                    transition: "all 0.15s",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {/* Source description */}
            {source === "own" && (
              <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary)" }}>
                <Swords size={12} style={{ marginRight: "5px", verticalAlign: "middle" }} />
                Positions from <strong>your own games</strong> where you missed a tactic — sorted by spaced repetition
              </p>
            )}
          </div>
        )}

        {/* ── Main grid ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "24px", alignItems: "start" }}>

          {/* Left — board area */}
          <div>
            {/* Survival status bar */}
            {mode === "survival" && !gameOver && (
              <div className="glass-card" style={{
                padding: "12px 20px", marginBottom: "16px",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div style={{ display: "flex", gap: "6px" }}>
                  {Array.from({ length: MAX_LIVES }).map((_, i) => (
                    <Heart key={i} size={20}
                      fill={i < lives ? "var(--danger)" : "none"}
                      color={i < lives ? "var(--danger)" : "var(--text-secondary)"}
                    />
                  ))}
                </div>
                <span style={{ fontWeight: 700 }}>
                  Score: <span style={{ color: "var(--accent-color)" }}>{score}</span>
                </span>
              </div>
            )}

            {/* Game Over */}
            {mode === "survival" && gameOver && !showSummary && (
              <div className="glass-card" style={{
                padding: "48px 32px", textAlign: "center",
                display: "flex", flexDirection: "column", alignItems: "center", gap: "20px",
              }}>
                <Trophy size={48} color="var(--warning)" />
                <h2 style={{ margin: 0 }}>Game Over</h2>
                <p style={{ margin: 0, color: "var(--text-secondary)" }}>
                  You solved <strong style={{ color: "var(--accent-color)" }}>{score}</strong> puzzle{score !== 1 ? "s" : ""} in a row
                </p>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button onClick={() => setShowSummary(true)} style={primaryBtn}>View Summary</button>
                  <button onClick={startSurvival} style={secondaryBtn}>Try Again</button>
                </div>
              </div>
            )}

            {/* Loading */}
            {loading && !(mode === "survival" && gameOver) && (
              <div className="glass-card" style={{ padding: "32px" }}>
                <Loader message="Loading puzzles…" />
              </div>
            )}

            {/* Error state */}
            {loadError && !loading && (
              <div className="glass-card" style={{
                padding: "20px", borderRadius: "12px",
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
                marginBottom: "12px",
              }}>
                <p style={{ margin: 0, color: "var(--danger)", fontWeight: 600, fontSize: "13px" }}>
                  {loadError}
                </p>
              </div>
            )}

            {/* Empty state */}
            {!loading && !puzzle && !loadError && !(mode === "survival" && gameOver) && (
              <div className="glass-card" style={{ padding: "48px 32px", textAlign: "center" }}>
                <p style={{ color: "var(--text-secondary)", marginBottom: "16px" }}>
                  {source === "own"
                    ? "No puzzles found — generate them from your analyzed games."
                    : "No library puzzles found for this filter."}
                </p>
                {source === "own" && (
                  <button onClick={handleGenerate} disabled={generating} style={primaryBtn}>
                    {generating ? "Generating…" : "Generate from My Games"}
                  </button>
                )}
              </div>
            )}

            {/* Board */}
            {!loading && puzzle && !(mode === "survival" && gameOver) && (
              <div className="glass-card" style={{ padding: "24px" }}>
                {mode === "time" ? (
                  <TimedPuzzleBoard
                    key={puzzle.puzzle_id}
                    puzzle={puzzle}
                    puzzleIndex={currentIndex}
                    totalPuzzles={puzzles.length}
                    timeLimit={timeLimit}
                    onAttempt={(solved, time, timedOut) => handleAttempt(solved, time, timedOut)}
                    onNext={handleNext}
                  />
                ) : (
                  <PuzzleBoard
                    key={puzzle.puzzle_id}
                    puzzle={puzzle}
                    puzzleIndex={currentIndex}
                    totalPuzzles={puzzles.length}
                    onAttempt={(solved, time) => handleAttempt(solved, time)}
                    onNext={handleNext}
                    ratingDelta={ratingDelta}
                  />
                )}
              </div>
            )}
          </div>

          {/* Right — stats sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Skill radar */}
            <div className="glass-card" style={{ padding: "20px" }}>
              <p style={{ margin: "0 0 12px", fontWeight: 700, fontSize: "14px" }}>Skill Radar</p>
              <PuzzleRadar accuracyByTheme={stats?.accuracy_by_theme ?? {}} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px" }}>
                <Stat label="Total" value={stats?.total_puzzles ?? 0} />
                <Stat label="Solved" value={stats?.total_attempted ?? 0} />
                <Stat label="This week" value={stats?.weekly_solved ?? 0} accent />
              </div>
            </div>

            {/* Mode cards (only in normal mode) */}
            {!isActiveMode && (
              <>
                <div className="glass-card" style={{ padding: "18px" }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
                    <Heart size={15} color="var(--danger)" />
                    <span style={{ fontWeight: 700, fontSize: "14px" }}>Survival Mode</span>
                  </div>
                  <p style={{ margin: "0 0 12px", color: "var(--text-secondary)", fontSize: "12px" }}>
                    3 lives. Wrong move loses a life. How far can you go?
                  </p>
                  <button onClick={startSurvival} style={{ ...modeBtn("var(--danger)"), width: "100%", justifyContent: "center" }}>
                    Start Survival
                  </button>
                </div>
                <div className="glass-card" style={{ padding: "18px" }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
                    <Clock size={15} color="var(--warning)" />
                    <span style={{ fontWeight: 700, fontSize: "14px" }}>Time Challenge</span>
                  </div>
                  <p style={{ margin: "0 0 12px", color: "var(--text-secondary)", fontSize: "12px" }}>
                    Blitz (10s) · Rapid (30s) · Classical (60s)
                  </p>
                  <button onClick={() => setShowTimeSetup(true)} style={{ ...modeBtn("var(--warning)"), width: "100%", justifyContent: "center" }}>
                    Start Timed
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Inline style helpers ──────────────────────────────────────────────────────
const primaryBtn: React.CSSProperties = {
  padding: "11px 24px", borderRadius: "8px", cursor: "pointer",
  background: "var(--accent-color)", color: "#fff",
  border: "none", fontWeight: 700, fontSize: "14px",
};
const secondaryBtn: React.CSSProperties = {
  padding: "11px 24px", borderRadius: "8px", cursor: "pointer",
  background: "transparent", color: "var(--text-secondary)",
  border: "1px solid var(--border-color)", fontWeight: 600, fontSize: "14px",
};
function modeBtn(color: string): React.CSSProperties {
  return {
    display: "flex", alignItems: "center", gap: "5px",
    padding: "8px 16px", borderRadius: "8px", cursor: "pointer",
    background: `${color}14`, color,
    border: `1px solid ${color}33`, fontWeight: 700, fontSize: "13px",
  };
}
function genBtn(disabled: boolean): React.CSSProperties {
  return {
    display: "flex", alignItems: "center", gap: "5px",
    padding: "8px 16px", borderRadius: "8px",
    cursor: disabled ? "default" : "pointer",
    background: "var(--accent-color)", color: "#fff",
    border: "none", fontWeight: 700, fontSize: "13px",
    opacity: disabled ? 0.7 : 1,
  };
}
function sourceBtn(active: boolean): React.CSSProperties {
  return {
    display: "flex", alignItems: "center", gap: "6px",
    padding: "9px 18px", borderRadius: "8px", cursor: "pointer",
    background: active ? "var(--accent-color)" : "transparent",
    color: active ? "#fff" : "var(--text-secondary)",
    border: `1px solid ${active ? "var(--accent-color)" : "var(--border-color)"}`,
    fontWeight: 700, fontSize: "13px", transition: "all 0.15s",
  };
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: "18px", fontWeight: 800, color: accent ? "var(--accent-color)" : "inherit" }}>
        {value}
      </div>
      <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{label}</div>
    </div>
  );
}
