"use client";

interface Props {
  move_number: number;
  turn_label?: string;
  san: string;
  quality: string;
  cp_loss?: number;
  phase?: string;
  best_move?: string;
  error_nature?: string;
  onClick?: () => void;
}

const QUALITY_COLORS: Record<string, string> = {
  Blunder: "var(--danger)",
  Mistake: "var(--warning)",
  Inaccuracy: "#f59e0b",
  Good: "var(--success)",
  Excellent: "var(--success)",
  Best: "#10b981",
  Brilliant: "#6366f1",
  Forced: "var(--text-secondary)",
};

const QUALITY_BG: Record<string, string> = {
  Blunder: "rgba(239,68,68,0.08)",
  Mistake: "rgba(245,158,11,0.08)",
  Inaccuracy: "rgba(245,158,11,0.05)",
  Good: "rgba(16,185,129,0.05)",
  Excellent: "rgba(16,185,129,0.05)",
  Best: "rgba(16,185,129,0.08)",
  Brilliant: "rgba(99,102,241,0.08)",
  Forced: "transparent",
};

const BORDER_COLOR: Record<string, string> = {
  Blunder: "var(--danger)",
  Mistake: "var(--warning)",
  Inaccuracy: "#f59e0b",
  Good: "var(--success)",
  Excellent: "var(--success)",
  Best: "var(--success)",
  Brilliant: "#6366f1",
  Forced: "var(--glass-border)",
};

export default function MistakeCard({
  move_number,
  turn_label,
  san,
  quality,
  cp_loss,
  phase,
  best_move,
  error_nature,
  onClick,
}: Props) {
  const borderColor = BORDER_COLOR[quality] || "var(--glass-border)";
  const bgColor = QUALITY_BG[quality] || "transparent";
  const qualityColor = QUALITY_COLORS[quality] || "var(--text-secondary)";

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        padding: "12px 16px",
        borderRadius: "8px",
        borderLeft: `4px solid ${borderColor}`,
        background: bgColor,
        cursor: onClick ? "pointer" : "default",
        transition: "opacity 0.15s",
      }}
      onMouseEnter={(e) =>
        onClick && ((e.currentTarget as HTMLDivElement).style.opacity = "0.85")
      }
      onMouseLeave={(e) =>
        onClick && ((e.currentTarget as HTMLDivElement).style.opacity = "1")
      }
    >
      <div style={{ minWidth: "44px", textAlign: "center" }}>
        <div
          style={{
            fontSize: "18px",
            fontWeight: "700",
            fontFamily: "monospace",
          }}
        >
          {san}
        </div>
        <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
          {turn_label || `#${move_number}`}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "8px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: "12px",
              fontWeight: "700",
              padding: "2px 8px",
              borderRadius: "4px",
              background: bgColor,
              color: qualityColor,
              border: `1px solid ${borderColor}`,
            }}
          >
            {quality}
          </span>
          {phase && (
            <span
              style={{
                fontSize: "11px",
                color: "var(--text-secondary)",
                textTransform: "capitalize",
              }}
            >
              {phase}
            </span>
          )}
          {cp_loss != null && cp_loss > 0 && (
            <span
              style={{
                fontSize: "11px",
                color: qualityColor,
                fontWeight: "600",
              }}
            >
              −{cp_loss} cp
            </span>
          )}
        </div>
        {best_move && (
          <div style={{ fontSize: "12px", color: "var(--success)" }}>
            Best:{" "}
            <span style={{ fontFamily: "monospace", fontWeight: "600" }}>
              {best_move}
            </span>
          </div>
        )}
        {error_nature && (
          <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            {error_nature}
          </div>
        )}
      </div>
    </div>
  );
}
