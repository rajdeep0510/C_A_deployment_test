"use client";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ResponsiveContainer, Tooltip,
} from "recharts";

const THEME_LABELS: Record<string, string> = {
  hanging_piece:      "Hanging",
  fork:               "Fork",
  pin:                "Pin",
  skewer:             "Skewer",
  back_rank:          "Back Rank",
  discovered_attack:  "Discovery",
  promotion:          "Promotion",
  checkmate:          "Checkmate",
  endgame_technique:  "Endgame",
  middlegame_tactic:  "Middlegame",
  smothered_mate:     "Smothered",
  sacrifice:          "Sacrifice",
  deflection:         "Deflection",
};

type Props = {
  accuracyByTheme: Record<string, number>;
};

export default function PuzzleRadar({ accuracyByTheme }: Props) {
  const entries = Object.entries(accuracyByTheme);
  if (entries.length === 0) {
    return (
      <p style={{ color: "var(--text-secondary)", fontSize: "13px", margin: 0, textAlign: "center", padding: "20px 0" }}>
        Solve puzzles to build your skill radar.
      </p>
    );
  }

  const data = entries.map(([theme, acc]) => ({
    subject: THEME_LABELS[theme] ?? theme.replace("_", " "),
    accuracy: acc,
    fullMark: 100,
  }));

  return (
    <div style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer>
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="rgba(0,0,0,0.08)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 100]}
            tick={false}
            axisLine={false}
          />
          <Radar
            name="Accuracy %"
            dataKey="accuracy"
            stroke="var(--accent-color)"
            fill="var(--accent-color)"
            fillOpacity={0.35}
          />
          <Tooltip
            formatter={(v: number) => [`${v}%`, "Accuracy"]}
            contentStyle={{
              background: "var(--card-bg)",
              border: "1px solid var(--glass-border)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
