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

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload ?? {};
  return (
    <div style={{
      background: "var(--card-bg)",
      border: "1px solid var(--glass-border)",
      borderRadius: "8px",
      padding: "10px 14px",
      fontSize: "13px",
      maxWidth: "220px",
    }}>
      <div style={{ fontWeight: "700", marginBottom: "2px" }}>{label}</div>
      {point.date && (
        <div style={{ color: "var(--text-secondary)", fontSize: "12px", marginBottom: "2px" }}>
          {point.date}
        </div>
      )}
      {point.opening && (
        <div style={{ color: "var(--text-secondary)", fontSize: "12px", marginBottom: "6px" }}>
          {point.opening}
        </div>
      )}
      <div style={{ color: "var(--accent-color)", fontWeight: "700" }}>
        {payload[0].value}% accuracy
      </div>
    </div>
  );
}

export default function ChartLine({
  data,
  dataKey = "uv",
  xAxisKey = "name",
}: {
  data: any[];
  dataKey?: string;
  xAxisKey?: string;
}) {
  if (!data || data.length === 0) return <div>No data available</div>;

  return (
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.05)"
            vertical={false}
          />
          <XAxis
            dataKey={xAxisKey}
            stroke="var(--text-secondary)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            padding={{ left: 10, right: 10 }}
            interval={Math.max(0, Math.floor(data.length / 8) - 1)}
          />
          <YAxis
            stroke="var(--text-secondary)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            domain={[0, 100]}
          />
          <Tooltip content={(props) => <CustomTooltip {...props} />} />
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
