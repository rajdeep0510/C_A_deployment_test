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
  puzzle_id:     string;
  fen:           string;
  best_move:     string;
  moves?:        string;
  theme:         string;
  difficulty:    number;
  phase?:        string;
  rating?:       number;
  source?:       string;
  gameUrl?:      string;
  game_filename?: string;
  move_number?:  number;
};
type Mode       = "normal" | "survival" | "time" | "rush";
type Phase      = "all" | "opening" | "middlegame" | "endgame";
type Source     = "own" | "library";
type Difficulty = "beginner" | "intermediate" | "advanced" | "expert";

const MAX_LIVES = 3;

type Category = "tactics" | "phase" | "endgame_material" | "openings";

const PHASE_TABS: { value: Phase; label: string; icon: string }[] = [
  { value: "all",        label: "All Games",  icon: "♟️" },
  { value: "opening",    label: "Opening",    icon: "📖" },
  { value: "middlegame", label: "Middlegame", icon: "⚔️" },
  { value: "endgame",    label: "Endgame",    icon: "👑" },
];

const THEME_META: Record<string, { label: string; icon: string; color: string }> = {
  hanging_piece:    { label: "Hanging Piece",    icon: "🪝", color: "#ef4444" },
  fork:             { label: "Fork",             icon: "🔱", color: "#f97316" },
  pin:              { label: "Pin",              icon: "📌", color: "#f59e0b" },
  skewer:           { label: "Skewer",           icon: "🏹", color: "#a855f7" },
  back_rank:        { label: "Back Rank",        icon: "🏰", color: "#3b82f6" },
  discovered_attack:{ label: "Discovered Attack",icon: "🎯", color: "#06b6d4" },
  promotion:        { label: "Promotion",        icon: "♕",  color: "#22c55e" },
  checkmate:        { label: "Missed Mate",      icon: "♛",  color: "#dc2626" },
  smothered_mate:   { label: "Smothered Mate",   icon: "🌀", color: "#9333ea" },
  sacrifice:        { label: "Sacrifice",        icon: "💥", color: "#ec4899" },
  middlegame_tactic:{ label: "Tactic",           icon: "⚡", color: "#6366f1" },
};

const CATEGORIES: { value: Category; label: string; icon: string }[] = [
  { value: "tactics",          label: "Tactics",      icon: "⚔️" },
  { value: "phase",            label: "Game Phase",   icon: "🎮" },
  { value: "endgame_material", label: "Endgame",      icon: "♟️" },
  { value: "openings",         label: "Openings",     icon: "📖" },
];

interface PuzzleTypeOption { value: string; label: string; icon: string; desc: string }

const TYPE_BY_CATEGORY: Record<Category, PuzzleTypeOption[]> = {
  tactics: [
    { value: "phase_middlegame",         label: "All Tactics",  icon: "⚔️", desc: "Mixed tactical positions" },
    { value: "tactic_fork",              label: "Fork",          icon: "🔱", desc: "Attack two pieces at once" },
    { value: "tactic_pin",               label: "Pin",           icon: "📌", desc: "Immobilize a piece" },
    { value: "tactic_skewer",            label: "Skewer",        icon: "🏹", desc: "Force a valuable piece to move" },
    { value: "tactic_sacrifice",         label: "Sacrifice",     icon: "💥", desc: "Give material to win" },
    { value: "tactic_discovered_attack", label: "Discovery",     icon: "🎯", desc: "Reveal a hidden attack" },
    { value: "mate_in_1",                label: "Mate in 1",     icon: "♛", desc: "One-move checkmate" },
    { value: "mate_in_2",                label: "Mate in 2",     icon: "♕", desc: "Force mate in two moves" },
    { value: "mate_in_3",                label: "Mate in 3",     icon: "♗", desc: "Three-move mating sequence" },
    { value: "mate_in_4plus",            label: "Mate in 4+",   icon: "♘", desc: "Long mating combinations" },
    { value: "mate_back_rank",           label: "Back Rank",     icon: "🏰", desc: "Exploit back rank weakness" },
    { value: "mate_smothered",           label: "Smothered",     icon: "🌀", desc: "Knight delivers smothered mate" },
    { value: "mate_opera",               label: "Opera Mate",    icon: "🎭", desc: "Classic rook + bishop mate" },
    { value: "mate_arabian",             label: "Arabian",       icon: "🐴", desc: "Knight + rook checkmate" },
  ],
  phase: [
    { value: "phase_opening",    label: "Opening",    icon: "♙", desc: "Tactics in the first 10–15 moves" },
    { value: "phase_middlegame", label: "Middlegame", icon: "⚔️", desc: "Complex tactical battles" },
    { value: "phase_endgame",    label: "Endgame",    icon: "👑", desc: "Convert advantages to a win" },
  ],
  endgame_material: [
    { value: "endgame_pawn",       label: "Pawn",        icon: "♟️", desc: "Pawn promotion & opposition" },
    { value: "endgame_rook",       label: "Rook",        icon: "♜", desc: "Rook vs pawn, Lucena, Philidor" },
    { value: "endgame_bishop",     label: "Bishop",      icon: "♝", desc: "Good vs bad bishop endgames" },
    { value: "endgame_knight",     label: "Knight",      icon: "♞", desc: "Knight manoeuvres & forks" },
    { value: "endgame_queen",      label: "Queen",       icon: "♛", desc: "Queen vs rook, queen vs pawn" },
    { value: "endgame_queen_rook", label: "Q + Rook",    icon: "⚡", desc: "Queen and rook coordination" },
  ],
  openings: [
    // 1.e4 openings
    { value: "opening_sicilian_defense",       label: "Sicilian",         icon: "🐉", desc: "1.e4 c5 — sharp & asymmetric" },
    { value: "opening_french_defense",         label: "French",           icon: "🛡️", desc: "1.e4 e6 — solid and strategic" },
    { value: "opening_caro-kann_defense",      label: "Caro-Kann",        icon: "🏰", desc: "1.e4 c6 — solid, less cramped" },
    { value: "opening_italian_game",           label: "Italian",          icon: "♗", desc: "1.e4 e5 Nf3 Nc6 Bc4" },
    { value: "opening_ruy_lopez",              label: "Ruy Lopez",        icon: "🗡️", desc: "1.e4 e5 Nf3 Nc6 Bb5" },
    { value: "opening_scotch_game",            label: "Scotch",           icon: "⚡", desc: "1.e4 e5 Nf3 Nc6 d4" },
    { value: "opening_four_knights_game",      label: "Four Knights",     icon: "♞", desc: "1.e4 e5 Nf3 Nc6 Nc3 Nf6" },
    { value: "opening_russian_game",           label: "Petrov",           icon: "🐻", desc: "1.e4 e5 Nf3 Nf6 — solid defence" },
    { value: "opening_philidor_defense",       label: "Philidor",         icon: "🎵", desc: "1.e4 e5 Nf3 d6 — solid but passive" },
    { value: "opening_bishops_opening",        label: "Bishop's Opening", icon: "♝", desc: "1.e4 e5 Bc4 — positional" },
    { value: "opening_kings_gambit_accepted",  label: "King's Gambit",    icon: "🔥", desc: "1.e4 e5 f4 exf4 — aggressive" },
    { value: "opening_kings_gambit_declined",  label: "KG Declined",      icon: "🛡️", desc: "1.e4 e5 f4 d5 — counter-strike" },
    { value: "opening_vienna_game",            label: "Vienna",           icon: "🎭", desc: "1.e4 e5 Nc3 — flexible setup" },
    { value: "opening_kings_pawn_game",        label: "King's Pawn",      icon: "♙", desc: "1.e4 e5 — open game mix" },
    { value: "opening_scandinavian_defense",   label: "Scandinavian",     icon: "⚔️", desc: "1.e4 d5 — early counterplay" },
    { value: "opening_alekhine_defense",       label: "Alekhine",         icon: "🔮", desc: "1.e4 Nf6 — provoke & counter" },
    { value: "opening_modern_defense",         label: "Modern",           icon: "🌐", desc: "1.e4 g6 — hypermodern fianchetto" },
    { value: "opening_pirc_defense",           label: "Pirc",             icon: "🦊", desc: "1.e4 d6 2.d4 Nf6 — flexible" },
    // 1.d4 openings
    { value: "opening_queens_gambit_declined", label: "QGD",              icon: "♕", desc: "1.d4 d5 c4 e6 — classical" },
    { value: "opening_queens_gambit_accepted", label: "QGA",              icon: "♔", desc: "1.d4 d5 c4 dxc4 — active" },
    { value: "opening_queens_pawn_game",       label: "Queen's Pawn",     icon: "♟️", desc: "1.d4 d5 — solid and safe" },
    { value: "opening_slav_defense",           label: "Slav",             icon: "❄️", desc: "1.d4 d5 c4 c6 — rock solid" },
    { value: "opening_kings_indian_defense",   label: "King's Indian",    icon: "🏯", desc: "1.d4 Nf6 c4 g6 — sharp & dynamic" },
    { value: "opening_benoni_defense",         label: "Benoni",           icon: "💣", desc: "1.d4 Nf6 c4 c5 — counterattack" },
    { value: "opening_indian_defense",         label: "Indian",           icon: "🐘", desc: "1.d4 Nf6 — hypermodern" },
    { value: "opening_nimzo-larsen_attack",    label: "Nimzo-Larsen",     icon: "🎪", desc: "1.b3 — fianchetto flank" },
    { value: "opening_nimzowitsch_defense",    label: "Nimzowitsch",      icon: "🧠", desc: "1.e4 Nc6 — provocative" },
    { value: "opening_zukertort_opening",      label: "Zukertort",        icon: "🕊️", desc: "1.Nf3 — flexible, transposes" },
    // Flank / other
    { value: "opening_english_opening",        label: "English",          icon: "🔄", desc: "1.c4 — flexible flank opening" },
    { value: "opening_dutch_defense",          label: "Dutch",            icon: "🌷", desc: "1.d4 f5 — aggressive & creative" },
    { value: "opening_englund_gambit",         label: "Englund Gambit",   icon: "🎰", desc: "1.d4 e5 — risky but fun" },
  ],
};

const DIFFICULTIES: { value: Difficulty; label: string; range: string; color: string }[] = [
  { value: "beginner",     label: "Beginner",     range: "< 1000",    color: "#22c55e" },
  { value: "intermediate", label: "Intermediate", range: "1000–1400", color: "#f59e0b" },
  { value: "advanced",     label: "Advanced",     range: "1400–1800", color: "#f97316" },
  { value: "expert",       label: "Expert",       range: "1800+",     color: "#ef4444" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatGameName(filename?: string): string {
  if (!filename) return "Your Game";
  const base = filename.replace(/\.pgn$/i, "");
  const dateMatch = base.match(/(\d{4})(\d{2})(\d{2})/);
  if (dateMatch) {
    const [, year, month] = dateMatch;
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[parseInt(month) - 1]} ${year}`;
  }
  return base.replace(/_/g, " ").slice(0, 30);
}

function extractPuzzle(item: any): Puzzle | null {
  const p = item?.puzzles ?? item?.puzzle_library ?? item;
  if (!p?.puzzle_id && !p?.id) return null;
  const isLibrary = !p.puzzle_id;
  return {
    puzzle_id:     p.puzzle_id ?? p.id,
    fen:           p.fen,
    best_move:     p.moves ? p.moves.split(" ")[0] : p.best_move,
    moves:         p.moves || undefined,
    theme:         p.themes ?? p.theme ?? "",
    difficulty:    p.difficulty ?? p.rating ?? 0,
    phase:         p.phase,
    rating:        p.rating ?? p.puzzle_rating,
    source:        isLibrary ? "library" : "own_game",
    gameUrl:       p.gameUrl ?? p.game_url,
    game_filename: p.game_filename,
    move_number:   p.move_number,
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
  const [phase,      setPhase]      = useState<Phase>("all");
  const [source,     setSource]     = useState<Source>("own");
  const [category,   setCategory]   = useState<Category>("tactics");
  const [puzzleType, setPuzzleType] = useState("phase_middlegame");
  const [difficulty, setDifficulty] = useState<Difficulty>("intermediate");

  function handleCategoryChange(cat: Category) {
    setCategory(cat);
    setPuzzleType(TYPE_BY_CATEGORY[cat][0].value);
  }

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
  }, [phase, source, puzzleType, difficulty]);

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
        const data = await getLibraryPuzzles(puzzleType, difficulty, 20);
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
      const resolvedPuzzleType = source === "library"
        ? puzzleType
        : (puzzle.theme ?? "");

      const result = await recordPuzzleAttempt(
        chessUsername,
        puzzle.puzzle_id,
        solved,
        timeTaken,
        puzzle.rating,
        (puzzle.source ?? "own_game") as "own_game" | "library",
        resolvedPuzzleType,
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
        <div className="container page-content-mobile" style={{ paddingTop: "32px", paddingBottom: "48px" }}>
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

      <div className="container page-content-mobile" style={{ paddingTop: "32px", paddingBottom: "48px" }}>

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

        {/* ── Source + filters (hidden during active mode) ── */}
        {!isActiveMode && (
          <div style={{ marginBottom: "24px", display: "flex", flexDirection: "column", gap: "0" }}>

            {/* ── Source tabs ── */}
            <div style={{ display: "flex", borderBottom: "2px solid var(--border-color)", marginBottom: "20px" }}>
              {([
                { value: "own" as Source,     icon: <Swords size={14}/>,   label: "Your Games" },
                { value: "library" as Source, icon: <BookOpen size={14}/>, label: "Lichess Library" },
              ]).map(s => (
                <button
                  key={s.value}
                  onClick={() => setSource(s.value)}
                  style={{
                    display: "flex", alignItems: "center", gap: "6px",
                    padding: "10px 20px", cursor: "pointer", fontSize: "14px", fontWeight: 700,
                    background: "transparent", border: "none",
                    borderBottom: source === s.value ? "2px solid var(--accent-color)" : "2px solid transparent",
                    color: source === s.value ? "var(--accent-color)" : "var(--text-secondary)",
                    marginBottom: "-2px", transition: "all 0.15s",
                  }}
                >
                  {s.icon} {s.label}
                </button>
              ))}
            </div>

            {/* ── Own games ── */}
            {source === "own" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

                {/* Phase tabs + sync button row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {PHASE_TABS.map((tab) => (
                      <button key={tab.value} onClick={() => setPhase(tab.value)} style={{
                        display: "flex", alignItems: "center", gap: "5px",
                        padding: "7px 16px", borderRadius: "20px", cursor: "pointer",
                        fontSize: "13px", fontWeight: 600,
                        background: phase === tab.value ? "var(--accent-color)" : "rgba(255,255,255,0.04)",
                        color: phase === tab.value ? "#fff" : "var(--text-secondary)",
                        border: `1.5px solid ${phase === tab.value ? "var(--accent-color)" : "var(--border-color)"}`,
                        transition: "all 0.15s",
                      }}>
                        <span>{tab.icon}</span> {tab.label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    style={{
                      display: "flex", alignItems: "center", gap: "5px",
                      padding: "7px 14px", borderRadius: "8px",
                      cursor: generating ? "default" : "pointer",
                      background: "rgba(29,193,137,0.08)", color: "var(--accent-color)",
                      border: "1px solid rgba(29,193,137,0.25)",
                      fontWeight: 600, fontSize: "12px", opacity: generating ? 0.7 : 1,
                    }}
                  >
                    <RefreshCw size={11} style={{ animation: generating ? "spin 1s linear infinite" : "none" }} />
                    {generating ? "Syncing…" : "Sync from games"}
                  </button>
                </div>

                {/* Explanation banner */}
                <div style={{
                  padding: "12px 16px", borderRadius: "10px",
                  background: "rgba(29,193,137,0.05)", border: "1px solid rgba(29,193,137,0.12)",
                  display: "flex", alignItems: "flex-start", gap: "10px",
                }}>
                  <span style={{ fontSize: "16px", flexShrink: 0, marginTop: "1px" }}>🎯</span>
                  <div>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: 600 }}>Only concrete missed tactics</p>
                    <p style={{ margin: "3px 0 0", fontSize: "12px", color: "var(--text-secondary)" }}>
                      Blunders and significant Mistakes only — hanging pieces, forks, missed mates.
                      Regular "not best" moves are excluded.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Lichess Library ── */}
            {source === "library" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

                {/* Difficulty pills */}
                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", marginRight: "4px" }}>
                    Level
                  </span>
                  {DIFFICULTIES.map((d) => (
                    <button key={d.value} onClick={() => setDifficulty(d.value)} style={{
                      padding: "5px 14px", borderRadius: "20px", cursor: "pointer",
                      fontSize: "12px", fontWeight: 700,
                      background: difficulty === d.value ? d.color : "transparent",
                      color: difficulty === d.value ? "#fff" : d.color,
                      border: `1.5px solid ${d.color}`,
                      transition: "all 0.15s",
                    }}>
                      {d.label} <span style={{ opacity: 0.7, fontWeight: 400 }}>{d.range}</span>
                    </button>
                  ))}
                </div>

                {/* Category tabs */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "8px",
                }}>
                  {CATEGORIES.map((cat) => {
                    const active = category === cat.value;
                    return (
                      <button key={cat.value} onClick={() => handleCategoryChange(cat.value)} style={{
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        gap: "6px", padding: "14px 8px", borderRadius: "12px", cursor: "pointer",
                        background: active ? "var(--accent-color)" : "rgba(255,255,255,0.03)",
                        color: active ? "#fff" : "var(--text-secondary)",
                        border: `1.5px solid ${active ? "var(--accent-color)" : "var(--border-color)"}`,
                        boxShadow: active ? "0 4px 16px rgba(29,193,137,0.2)" : "none",
                        transition: "all 0.2s", fontWeight: 700, fontSize: "13px",
                      }}>
                        <span style={{ fontSize: "22px", lineHeight: 1 }}>{cat.icon}</span>
                        {cat.label}
                      </button>
                    );
                  })}
                </div>

                {/* Type cards grid */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                  gap: "10px",
                }}>
                  {TYPE_BY_CATEGORY[category].map((t) => {
                    const active = puzzleType === t.value;
                    return (
                      <button key={t.value} onClick={() => setPuzzleType(t.value)} style={{
                        display: "flex", alignItems: "center", gap: "12px",
                        padding: "12px 14px", borderRadius: "12px", cursor: "pointer",
                        background: active ? "rgba(29,193,137,0.12)" : "rgba(255,255,255,0.03)",
                        border: `1.5px solid ${active ? "var(--accent-color)" : "var(--border-color)"}`,
                        transition: "all 0.15s", textAlign: "left",
                        boxShadow: active ? "0 0 0 1px rgba(29,193,137,0.3)" : "none",
                      }}>
                        <span style={{
                          fontSize: "22px", lineHeight: 1, flexShrink: 0,
                          width: "36px", height: "36px",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: active ? "rgba(29,193,137,0.15)" : "rgba(255,255,255,0.05)",
                          borderRadius: "8px",
                        }}>
                          {t.icon}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            fontWeight: 700, fontSize: "13px",
                            color: active ? "var(--accent-color)" : "var(--text-primary)",
                          }}>
                            {t.label}
                          </div>
                          <div style={{
                            fontSize: "11px", color: "var(--text-secondary)",
                            marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          }}>
                            {t.desc}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

              </div>
            )}
          </div>
        )}

        {/* ── Main grid ── */}
        <div className="puzzle-main-grid">

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
                {source === "own" ? (
                  <>
                    <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎯</div>
                    <h3 style={{ margin: "0 0 8px", fontSize: "18px" }}>No missed tactics found</h3>
                    <p style={{ margin: "0 0 20px", color: "var(--text-secondary)", fontSize: "13px", maxWidth: "400px", marginInline: "auto" }}>
                      Sync your analyzed games to extract positions where you missed concrete tactics.
                    </p>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "center", marginBottom: "24px" }}>
                      {[["🪝","Hanging Piece"], ["🔱","Fork"], ["📌","Pin"], ["♛","Missed Mate"], ["🎯","Discovery"]].map(([icon, name]) => (
                        <span key={name} style={{
                          padding: "5px 12px", borderRadius: "6px", fontSize: "12px",
                          background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-color)",
                          color: "var(--text-secondary)",
                        }}>
                          {icon} {name}
                        </span>
                      ))}
                    </div>
                    <button onClick={handleGenerate} disabled={generating} style={primaryBtn}>
                      {generating ? "Syncing…" : "Sync from My Analyzed Games"}
                    </button>
                  </>
                ) : (
                  <p style={{ color: "var(--text-secondary)" }}>
                    No library puzzles found for this filter.
                  </p>
                )}
              </div>
            )}

            {/* Own-game context banner */}
            {!loading && puzzle && source === "own" && !(mode === "survival" && gameOver) && !(mode === "time") && (
              <div style={{
                marginBottom: "10px", padding: "12px 16px", borderRadius: "10px",
                background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-color)",
                display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap",
              }}>
                {/* Theme badge */}
                {(() => {
                  const meta = THEME_META[puzzle.theme] ?? { label: puzzle.theme || "Tactic", icon: "⚡", color: "#6366f1" };
                  return (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: "4px",
                      padding: "4px 10px", borderRadius: "6px",
                      background: `${meta.color}1a`, color: meta.color,
                      border: `1px solid ${meta.color}30`,
                      fontWeight: 700, fontSize: "12px",
                    }}>
                      {meta.icon} {meta.label}
                    </span>
                  );
                })()}
                {puzzle.move_number != null && (
                  <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600 }}>
                    Move {puzzle.move_number}
                  </span>
                )}
                <span style={{ color: "var(--border-color)", fontSize: "10px" }}>·</span>
                <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  📁 {formatGameName(puzzle.game_filename)}
                </span>
                <span style={{ marginLeft: "auto", fontSize: "11px", color: "var(--text-secondary)", opacity: 0.7 }}>
                  {currentIndex + 1} / {puzzles.length}
                </span>
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
