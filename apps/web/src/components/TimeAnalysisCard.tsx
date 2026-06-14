"use client";
import { Clock } from "lucide-react";

interface Props {
  avg_time_per_move?: number;
  phase_breakdown?: Record<string, number>;
  time_pressure_risk?: string;
  think_move_count?: number;
}

const RISK_COLOR: Record<string, string> = {
  High: "var(--danger)",
  Moderate: "var(--warning)",
  Low: "var(--success)",
};

export default function TimeAnalysisCard({
  avg_time_per_move,
  phase_breakdown,
  time_pressure_risk,
  think_move_count,
}: Props) {
  const riskColor =
    RISK_COLOR[time_pressure_risk || ""] || "var(--text-secondary)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "12px",
        }}
      >
        {avg_time_per_move != null && (
          <div
            style={{
              padding: "14px",
              background: "var(--surface-1)",
              borderRadius: "8px",
              border: "1px solid var(--glass-border)",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                marginBottom: "6px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Clock size={11} /> Avg per Move
            </div>
            <div style={{ fontSize: "20px", fontWeight: "700" }}>
              {avg_time_per_move.toFixed(1)}s
            </div>
          </div>
        )}
        {think_move_count != null && (
          <div
            style={{
              padding: "14px",
              background: "var(--surface-1)",
              borderRadius: "8px",
              border: "1px solid var(--glass-border)",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                marginBottom: "6px",
              }}
            >
              Think Moves
            </div>
            <div style={{ fontSize: "20px", fontWeight: "700" }}>
              {think_move_count}
            </div>
          </div>
        )}
        {time_pressure_risk && (
          <div
            style={{
              padding: "14px",
              background: "var(--surface-1)",
              borderRadius: "8px",
              border: `1px solid ${riskColor}22`,
            }}
          >
            <div
              style={{
                fontSize: "11px",
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                marginBottom: "6px",
              }}
            >
              Time Pressure Risk
            </div>
            <div
              style={{ fontSize: "16px", fontWeight: "700", color: riskColor }}
            >
              {time_pressure_risk}
            </div>
          </div>
        )}
      </div>

      {phase_breakdown && Object.keys(phase_breakdown).length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div
            style={{
              fontSize: "12px",
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              marginBottom: "4px",
            }}
          >
            Time by Phase
          </div>
          {Object.entries(phase_breakdown).map(([phase, secs]) => (
            <div
              key={phase}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: "13px",
                  textTransform: "capitalize",
                  color: "var(--text-secondary)",
                }}
              >
                {phase}
              </span>
              <span style={{ fontSize: "13px", fontWeight: "600" }}>
                {(secs as number).toFixed(1)}s avg
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
