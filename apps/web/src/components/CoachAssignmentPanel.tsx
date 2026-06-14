"use client";
import { useState } from "react";
import { getThemedPuzzles } from "@/services/api";
import { BookOpen, CheckCircle } from "lucide-react";

const THEMES = [
  { value: "hanging_piece",     label: "Hanging Piece" },
  { value: "fork",              label: "Fork" },
  { value: "pin",               label: "Pin" },
  { value: "skewer",            label: "Skewer" },
  { value: "back_rank",         label: "Back Rank Mate" },
  { value: "discovered_attack", label: "Discovered Attack" },
  { value: "promotion",         label: "Promotion" },
];

const DIFFICULTY_RANGES: Record<string, { min: number; max: number; label: string }> = {
  beginner:     { min: 0,   max: 200, label: "Beginner (0–200 cp)" },
  intermediate: { min: 200, max: 400, label: "Intermediate (200–400 cp)" },
  advanced:     { min: 400, max: 700, label: "Advanced (400–700 cp)" },
  expert:       { min: 700, max: 9999, label: "Expert (700+ cp)" },
};

type Props = {
  studentUsername: string;
  coachId: string;
};

export default function CoachAssignmentPanel({ studentUsername, coachId }: Props) {
  const [theme, setTheme] = useState("hanging_piece");
  const [difficulty, setDifficulty] = useState("beginner");
  const [count, setCount] = useState(5);
  const [assigning, setAssigning] = useState(false);
  const [result, setResult] = useState<{ found: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAssign() {
    setAssigning(true);
    setResult(null);
    setError(null);
    try {
      const range = DIFFICULTY_RANGES[difficulty];
      const data = await getThemedPuzzles(theme, range.min, range.max, count);
      if (!data) {
        setError(`No puzzles found for theme "${theme}" at this difficulty.`);
      } else {
        setResult({ found: data.count });
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to fetch puzzles");
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="glass-card" style={{ padding: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
        <BookOpen size={18} color="var(--accent-color)" />
        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>Assign Puzzle Drill</h3>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {/* Student */}
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Student
          </label>
          <div style={{
            padding: "10px 14px", borderRadius: "8px",
            background: "rgba(29,193,137,0.08)", color: "var(--accent-color)",
            fontWeight: 700, fontSize: "14px", border: "1px solid rgba(29,193,137,0.2)",
          }}>
            {studentUsername}
          </div>
        </div>

        {/* Theme */}
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Tactical Theme
          </label>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            style={{
              width: "100%", padding: "10px 14px", borderRadius: "8px",
              background: "var(--card-bg)", color: "var(--text-primary)",
              border: "1px solid var(--border-color)", fontSize: "14px",
            }}
          >
            {THEMES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Difficulty */}
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Difficulty
          </label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            style={{
              width: "100%", padding: "10px 14px", borderRadius: "8px",
              background: "var(--card-bg)", color: "var(--text-primary)",
              border: "1px solid var(--border-color)", fontSize: "14px",
            }}
          >
            {Object.entries(DIFFICULTY_RANGES).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </div>

        {/* Count */}
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Number of Puzzles
          </label>
          <div style={{ display: "flex", gap: "8px" }}>
            {[5, 10, 15, 20].map((n) => (
              <button
                key={n}
                onClick={() => setCount(n)}
                style={{
                  flex: 1, padding: "8px", borderRadius: "8px", cursor: "pointer",
                  background: count === n ? "var(--accent-color)" : "transparent",
                  color: count === n ? "#fff" : "var(--text-secondary)",
                  border: `1px solid ${count === n ? "var(--accent-color)" : "var(--border-color)"}`,
                  fontWeight: 700, fontSize: "14px", transition: "all 0.15s",
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Assign button */}
        <button
          onClick={handleAssign}
          disabled={assigning}
          style={{
            padding: "12px", borderRadius: "8px", cursor: assigning ? "default" : "pointer",
            background: "var(--accent-color)", color: "#fff",
            border: "none", fontWeight: 700, fontSize: "14px",
            opacity: assigning ? 0.7 : 1, marginTop: "4px",
          }}
        >
          {assigning ? "Finding Puzzles..." : "Assign Drill"}
        </button>

        {/* Result */}
        {result && (
          <div style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "12px 14px", borderRadius: "8px",
            background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)",
          }}>
            <CheckCircle size={16} color="var(--success)" />
            <span style={{ color: "var(--success)", fontWeight: 600, fontSize: "13px" }}>
              Found {result.found} puzzle{result.found !== 1 ? "s" : ""} — assigned to {studentUsername}
            </span>
          </div>
        )}

        {error && (
          <div style={{
            padding: "12px 14px", borderRadius: "8px",
            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
            color: "var(--danger)", fontSize: "13px", fontWeight: 600,
          }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
