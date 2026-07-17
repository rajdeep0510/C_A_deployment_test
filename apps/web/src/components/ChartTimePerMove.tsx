"use client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface TimePerMovePoint {
  move: number;
  avg_time: number;
}

interface Props {
  data: TimePerMovePoint[];
}

export default function ChartTimePerMove({ data }: Props) {
  if (!data.length) {
    return (
      <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
        No clock data available for analyzed games.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 20, bottom: 32 }}>
        <CartesianGrid vertical={false} stroke="var(--border-subtle)" />
        <XAxis
          dataKey="move"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
          tickFormatter={(v) => (v % 4 === 1 ? String(v) : "")}
          label={{
            value: "Move number",
            position: "insideBottom",
            offset: -18,
            fontSize: 11,
            fill: "var(--text-secondary)",
          }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
          tickFormatter={(v) => `${v}s`}
          label={({ viewBox }: any) => {
            const { x, y, height } = viewBox;
            const cx = x - 12;
            const cy = y + height / 2;
            return (
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                transform={`rotate(-90, ${cx}, ${cy})`}
                fontSize={11}
                fill="var(--text-secondary)"
              >
                Avg. seconds
              </text>
            );
          }}
        />
        <Tooltip
          formatter={(v: number) => [`${v}s`, "Avg time"]}
          contentStyle={{
            background: "var(--surface-2)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "8px",
            fontSize: "12px",
          }}
        />
        <Bar dataKey="avg_time" fill="#3b82f6" radius={[2, 2, 0, 0]} maxBarSize={12} />
      </BarChart>
    </ResponsiveContainer>
  );
}
