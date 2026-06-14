"use client";

const LABELS: Record<string, string> = {
  tactical_oversight: "Tactical Oversight",
  hanging_piece: "Hanging Piece",
  missed_fork: "Missed Fork",
  missed_pin: "Missed Pin",
  total_tactical_errors: "Total Tactical Errors",

  positional_misjudgment: "Positional Misjudgment",
  bad_piece_placement: "Bad Piece Placement",
  weak_pawn_structure: "Weak Pawn Structure",
  king_safety_error: "King Safety Error",
  total_positional_errors: "Total Positional Errors",

  endgame_blunders: "Endgame Blunders",
  king_activity: "King Activity Issues",
  pawn_promotion_error: "Promotion Error",
  theoretical_endgame_miss: "Theoretical Miss",
  total_endgame_errors: "Total Endgame Errors",

  blitzing_error: "Blitzing Error",
  scramble_blunder: "Scramble Blunder",
  panic_mode: "Panic Mode",
  total_time_pressure_errors: "Total Time Pressure Errors",
};

function isTotal(key: string) {
  return key.startsWith("total_");
}

function PatternCard({
  title,
  summary,
  color,
}: {
  title: string;
  summary: Record<string, number>;
  color: string;
}) {
  if (!summary) return null;
  const entries = Object.entries(summary);
  const totals = entries.filter(([k]) => isTotal(k));
  const details = entries.filter(([k]) => !isTotal(k));

  return (
    <div
      style={{
        padding: "20px",
        background: "var(--surface-1)",
        borderRadius: "10px",
        border: "1px solid var(--glass-border)",
        borderTop: `3px solid ${color}`,
      }}
    >
      <div
        style={{
          fontWeight: "700",
          fontSize: "14px",
          marginBottom: "12px",
          color,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {details.map(([key, val]) => (
          <div
            key={key}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              {LABELS[key] || key}
            </span>
            <span
              style={{
                fontSize: "13px",
                fontWeight: "700",
                color: (val as number) > 0 ? color : "var(--text-secondary)",
                minWidth: "24px",
                textAlign: "right",
              }}
            >
              {val as number}
            </span>
          </div>
        ))}
        {totals.map(([key, val]) => (
          <div
            key={key}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "8px",
              paddingTop: "8px",
              borderTop: "1px solid var(--glass-border)",
            }}
          >
            <span
              style={{
                fontSize: "12px",
                fontWeight: "600",
                color: "var(--text-secondary)",
                textTransform: "uppercase",
              }}
            >
              {LABELS[key] || key}
            </span>
            <span
              style={{
                fontSize: "14px",
                fontWeight: "700",
                color: (val as number) > 0 ? color : "var(--text-secondary)",
              }}
            >
              {val as number}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface Props {
  tactical?: Record<string, number>;
  positional?: Record<string, number>;
  endgame?: Record<string, number>;
  time_pressure?: Record<string, number>;
}

export default function PatternGrid({
  tactical,
  positional,
  endgame,
  time_pressure,
}: Props) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "16px",
      }}
    >
      <PatternCard title="Tactical" summary={tactical} color="#6366f1" />
      <PatternCard
        title="Positional"
        summary={positional}
        color="var(--warning)"
      />
      <PatternCard
        title="Endgame"
        summary={endgame}
        color="var(--accent-color)"
      />
      <PatternCard
        title="Time Pressure"
        summary={time_pressure}
        color="var(--danger)"
      />
    </div>
  );
}
