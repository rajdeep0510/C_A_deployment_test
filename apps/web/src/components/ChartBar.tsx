"use client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface BarConfig {
  key: string;
  color: string;
  label: string;
}

interface Props {
  data: any[];
  xKey: string;
  bars: BarConfig[];
  horizontal?: boolean;
  height?: number;
}

export default function ChartBar({
  data,
  xKey,
  bars,
  horizontal = false,
  height = 260,
}: Props) {
  if (!data || data.length === 0)
    return (
      <div style={{ color: "var(--text-secondary)", padding: "16px" }}>
        No data available
      </div>
    );

  const layout = horizontal ? "vertical" : "horizontal";

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart
          data={data}
          layout={layout}
          margin={{ top: 4, right: 16, bottom: 4, left: horizontal ? 100 : 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.05)"
            horizontal={!horizontal}
            vertical={horizontal}
          />
          {horizontal ? (
            <>
              <XAxis
                type="number"
                stroke="var(--text-secondary)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                domain={[0, "auto"]}
              />
              <YAxis
                type="category"
                dataKey={xKey}
                stroke="var(--text-secondary)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={95}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={xKey}
                stroke="var(--text-secondary)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--text-secondary)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
            </>
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--card-bg)",
              border: "1px solid var(--glass-border)",
              borderRadius: "8px",
              fontSize: "13px",
            }}
            itemStyle={{ color: "var(--text-primary)" }}
          />
          {bars.length > 1 && (
            <Legend
              iconType="circle"
              iconSize={10}
              formatter={(value) => (
                <span
                  style={{ color: "var(--text-secondary)", fontSize: "12px" }}
                >
                  {value}
                </span>
              )}
            />
          )}
          {bars.map((b) => (
            <Bar
              key={b.key}
              dataKey={b.key}
              name={b.label}
              fill={b.color}
              radius={[3, 3, 0, 0]}
              maxBarSize={40}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
