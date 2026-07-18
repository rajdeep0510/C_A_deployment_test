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
  Book: "#9ca3af",
  Forced: "#6b7280",
  Good: "#4ade80",
  Excellent: "#22c55e",
  Best: "#16a34a",
  Inaccuracy: "#eab308",
  Mistake: "#f97316",
  Blunder: "var(--danger)",
  Great: "#3b82f6",
  Brilliant: "#4f46e5",
};

const QUALITY_BG: Record<string, string> = {
  Book: "rgba(156,163,175,0.08)",
  Forced: "transparent",
  Good: "rgba(74,222,128,0.05)",
  Excellent: "rgba(34,197,94,0.05)",
  Best: "rgba(22,163,74,0.08)",
  Inaccuracy: "rgba(234,179,8,0.06)",
  Mistake: "rgba(249,115,22,0.08)",
  Blunder: "rgba(239,68,68,0.08)",
  Great: "rgba(59,130,246,0.08)",
  Brilliant: "rgba(79,70,229,0.08)",
};

const BORDER_COLOR: Record<string, string> = {
  Book: "#9ca3af",
  Forced: "var(--glass-border)",
  Good: "#4ade80",
  Excellent: "#22c55e",
  Best: "#16a34a",
  Inaccuracy: "#eab308",
  Mistake: "var(--warning)",
  Blunder: "var(--danger)",
  Great: "#3b82f6",
  Brilliant: "#4f46e5",
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
