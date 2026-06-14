"use client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function ChartLine({ data, dataKey = "uv", xAxisKey = "name" }) {
  if (!data || data.length === 0) return <div>No data available</div>;

  return (
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer>
        <LineChart
          data={data}
          margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.05)"
            vertical={false}
          />
          <XAxis
            dataKey={xAxisKey}
            stroke="var(--text-secondary)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            padding={{ left: 10, right: 10 }}
          />
          <YAxis
            stroke="var(--text-secondary)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            domain={[0, 100]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--card-bg)",
              border: "1px solid var(--glass-border)",
              borderRadius: "8px",
            }}
            itemStyle={{ color: "var(--accent-color)" }}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke="var(--accent-color)"
            strokeWidth={3}
            dot={{ r: 4, fill: "var(--bg-color)", strokeWidth: 2 }}
            activeDot={{ r: 6, fill: "var(--accent-color)" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
