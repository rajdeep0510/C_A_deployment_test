"use client";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export default function ChartRadar({ data, dataKey = "A" }) {
  if (!data || data.length === 0) return <div>No data available</div>;

  return (
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer>
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid stroke="rgba(255,255,255,0.1)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 100]}
            tick={false}
            axisLine={false}
          />
          <Radar
            name="Performance"
            dataKey={dataKey}
            stroke="var(--accent-color)"
            fill="var(--accent-color)"
            fillOpacity={0.5}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--card-bg)",
              border: "1px solid var(--glass-border)",
              borderRadius: "8px",
            }}
            itemStyle={{ color: "var(--text-primary)" }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
