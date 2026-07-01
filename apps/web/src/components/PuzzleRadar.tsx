"use client";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ResponsiveContainer, Tooltip,
} from "recharts";

const CATEGORY_LABELS: Record<string, string> = {
  tactics:          "Tactics",
  phase:            "Game Phase",
  endgame_material: "Endgame",
  openings:         "Openings",
  // legacy own-game theme names
  hanging_piece:    "Hanging",
  fork:             "Fork",
  pin:              "Pin",
  skewer:           "Skewer",
  back_rank:        "Back Rank",
  discovered_attack:"Discovery",
  promotion:        "Promotion",
  checkmate:        "Checkmate",
  endgame_technique:"Endgame",
  middlegame_tactic:"Middlegame",
  smothered_mate:   "Smothered",
  sacrifice:        "Sacrifice",
  deflection:       "Deflection",
};

type Props = {
  accuracyByTheme: Record<string, number>;
};

export default function PuzzleRadar({ accuracyByTheme }: Props) {
  const entries = Object.entries(accuracyByTheme).filter(([, v]) => v > 0);
  if (entries.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "28px 0" }}>
        <div style={{ fontSize: "28px", marginBottom: "8px" }}>🎯</div>
        <p style={{ color: "var(--text-secondary)", fontSize: "13px", margin: 0 }}>
          Solve puzzles to build your skill radar
        </p>
      </div>
    );
  }

  const data = entries.map(([theme, score]) => ({
    subject:  CATEGORY_LABELS[theme] ?? theme.replace(/_/g, " "),
    score,
    fullMark: 100,
  }));

  return (
    <div style={{ width: "100%", height: 230 }}>
      <ResponsiveContainer>
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="rgba(255,255,255,0.08)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: "var(--text-secondary)", fontSize: 11, fontWeight: 600 }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 100]}
            tick={false}
            axisLine={false}
          />
          <Radar
            name="Skill"
            dataKey="score"
            stroke="var(--accent-color)"
            fill="var(--accent-color)"
            fillOpacity={0.3}
            strokeWidth={2}
          />
          <Tooltip
            formatter={(v: number) => [`${v}/100`, "Skill level"]}
            contentStyle={{
              background: "var(--card-bg, #1a1a2e)",
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
