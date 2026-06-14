"use client";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface PieEntry {
  name: string;
  value: number;
  color: string;
}

interface Props {
  data: PieEntry[];
  title?: string;
}

export default function ChartPie({ data, title }: Props) {
  const filtered = (data || []).filter((d) => d.value > 0);
  if (filtered.length === 0)
    return (
      <div style={{ color: "var(--text-secondary)", padding: "16px" }}>
        No data available
      </div>
    );

  return (
    <div style={{ width: "100%", height: 280 }}>
      {title && (
        <h4 style={{ marginBottom: "8px", fontSize: "15px" }}>{title}</h4>
      )}
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={filtered}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={95}
            paddingAngle={3}
            dataKey="value"
          >
            {filtered.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--card-bg)",
              border: "1px solid var(--glass-border)",
              borderRadius: "8px",
              fontSize: "13px",
            }}
            itemStyle={{ color: "var(--text-primary)" }}
          />
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
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
