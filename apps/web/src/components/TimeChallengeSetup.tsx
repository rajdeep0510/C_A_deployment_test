"use client";
import { Clock, Zap } from "lucide-react";
import type { TimeLimit } from "./TimedPuzzleBoard";

const OPTIONS: { value: TimeLimit; label: string; desc: string; color: string }[] = [
  { value: 10, label: "Blitz",     desc: "10 seconds per puzzle",  color: "#ef4444" },
  { value: 30, label: "Rapid",     desc: "30 seconds per puzzle",  color: "#f97316" },
  { value: 60, label: "Classical", desc: "60 seconds per puzzle",  color: "#f59e0b" },
];

type Props = {
  onStart: (limit: TimeLimit) => void;
  onCancel: () => void;
};

export default function TimeChallengeSetup({ onStart, onCancel }: Props) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px",
    }}>
      <div className="glass-card" style={{ width: "100%", maxWidth: "400px", padding: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
          <Clock size={22} color="var(--warning)" />
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800 }}>Time Challenge</h2>
        </div>
        <p style={{ margin: "0 0 24px", color: "var(--text-secondary)", fontSize: "14px" }}>
          Choose your time limit per puzzle. Run out of time and the puzzle is marked incorrect.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onStart(opt.value)}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "14px 18px", borderRadius: "10px", cursor: "pointer",
                background: `${opt.color}12`,
                border: `1px solid ${opt.color}33`,
                textAlign: "left", width: "100%",
                transition: "background 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Zap size={16} color={opt.color} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: "15px", color: opt.color }}>
                    {opt.label}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                    {opt.desc}
                  </div>
                </div>
              </div>
              <span style={{ fontSize: "22px", fontWeight: 800, color: opt.color }}>
                {opt.value}s
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={onCancel}
          style={{
            width: "100%", padding: "10px", borderRadius: "8px", cursor: "pointer",
            background: "transparent", color: "var(--text-secondary)",
            border: "1px solid var(--border-color)", fontWeight: 600, fontSize: "14px",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
