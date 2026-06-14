"use client";
import { Trophy, Target, Clock, RotateCcw } from "lucide-react";

type Props = {
  solved: number;
  total: number;
  avgTimeSecs: number;
  mode: string;
  onRestart: () => void;
  onExit: () => void;
};

export default function SessionSummary({ solved, total, avgTimeSecs, mode, onRestart, onExit }: Props) {
  const accuracy = total > 0 ? Math.round((solved / total) * 100) : 0;
  const grade =
    accuracy >= 80 ? { label: "Excellent", color: "var(--success)" } :
    accuracy >= 60 ? { label: "Good",      color: "var(--accent-color)" } :
    accuracy >= 40 ? { label: "Fair",       color: "var(--warning)" } :
                     { label: "Keep Going", color: "var(--danger)" };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px",
    }}>
      <div className="glass-card" style={{ width: "100%", maxWidth: "440px", padding: "40px", textAlign: "center" }}>
        <Trophy size={48} color="var(--warning)" style={{ marginBottom: "16px" }} />
        <h2 style={{ margin: "0 0 4px", fontSize: "24px", fontWeight: 800 }}>Session Complete</h2>
        <p style={{ margin: "0 0 28px", color: "var(--text-secondary)", fontSize: "14px" }}>
          {mode} mode
        </p>

        {/* Grade */}
        <div style={{
          display: "inline-block", padding: "6px 20px", borderRadius: "20px",
          background: `${grade.color}18`, color: grade.color,
          border: `1px solid ${grade.color}33`,
          fontWeight: 700, fontSize: "16px", marginBottom: "28px",
        }}>
          {grade.label}
        </div>

        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "28px" }}>
          {[
            { icon: <Target size={18} />, label: "Solved", value: `${solved}/${total}` },
            { icon: <Trophy size={18} />, label: "Accuracy", value: `${accuracy}%` },
            { icon: <Clock size={18} />, label: "Avg Time", value: `${Math.round(avgTimeSecs)}s` },
          ].map((stat) => (
            <div key={stat.label} className="glass-card" style={{ padding: "14px 8px" }}>
              <div style={{ color: "var(--accent-color)", marginBottom: "6px", display: "flex", justifyContent: "center" }}>
                {stat.icon}
              </div>
              <div style={{ fontSize: "20px", fontWeight: 800, marginBottom: "2px" }}>{stat.value}</div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={onRestart}
            style={{
              flex: 1, padding: "12px", borderRadius: "8px", cursor: "pointer",
              background: "var(--accent-color)", color: "#fff",
              border: "none", fontWeight: 700, fontSize: "14px",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
            }}
          >
            <RotateCcw size={14} /> Play Again
          </button>
          <button
            onClick={onExit}
            style={{
              flex: 1, padding: "12px", borderRadius: "8px", cursor: "pointer",
              background: "transparent", color: "var(--text-secondary)",
              border: "1px solid var(--border-color)", fontWeight: 600, fontSize: "14px",
            }}
          >
            Exit
          </button>
        </div>
      </div>
    </div>
  );
}
