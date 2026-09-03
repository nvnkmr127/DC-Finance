"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatINR, formatINRCompact } from "@/lib/format";

const axisStyle = { fontSize: 12, fill: "var(--muted-foreground)" };

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function TooltipBox({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: {
    name: string;
    value: number;
    color?: string;
    payload?: { fill?: string };
  }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-sm">
      {label && <p className="mb-1 font-medium">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 capitalize">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: p.color ?? p.payload?.fill }}
          />
          {p.name}: {formatINR(p.value)}
        </p>
      ))}
    </div>
  );
}

// Revenue vs Expenses monthly line chart.
export function RevenueExpenseLineChart({
  data,
}: {
  data: { month: string; revenue: number; expenses: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="month" tick={axisStyle} tickLine={false} axisLine={false} />
        <YAxis
          tick={axisStyle}
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={formatINRCompact}
        />
        <Tooltip content={<TooltipBox />} />
        <Legend
          iconType="plainline"
          formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>}
        />
        <Line
          type="monotone"
          dataKey="revenue"
          name="Revenue"
          stroke="var(--chart-1)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="expenses"
          name="Expenses"
          stroke="var(--chart-4)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Monthly profit — bars colored by sign (green positive, red negative).
export function ProfitBarChart({
  data,
}: {
  data: { month: string; profit: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="month" tick={axisStyle} tickLine={false} axisLine={false} />
        <YAxis
          tick={axisStyle}
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={formatINRCompact}
        />
        <Tooltip content={<TooltipBox />} cursor={{ fill: "var(--muted)" }} />
        <Bar dataKey="profit" name="Profit" fill="var(--chart-1)" radius={[4, 4, 0, 0]}>
          {data.map((dp, i) => (
            <Cell key={i} fill={dp.profit >= 0 ? "var(--chart-1)" : "var(--chart-5)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Monthly revenue bars (single client or overall).
export function RevenueBarChart({
  data,
}: {
  data: { month: string; amount: number }[];
}) {
  if (data.every((d) => d.amount === 0)) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
        No revenue in this period
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="month" tick={axisStyle} tickLine={false} axisLine={false} />
        <YAxis
          tick={axisStyle}
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={formatINRCompact}
        />
        <Tooltip content={<TooltipBox />} cursor={{ fill: "var(--muted)" }} />
        <Bar dataKey="amount" name="Revenue" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Generic donut for category breakdowns.
export function BreakdownDonut({
  data,
  colors,
}: {
  data: { name: string; value: number }[];
  colors?: string[];
}) {
  const palette = colors ?? PALETTE;
  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        No data for this month
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={60}
          outerRadius={95}
          paddingAngle={2}
          strokeWidth={0}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={palette[i % palette.length]} />
          ))}
        </Pie>
        <Tooltip content={<TooltipBox />} />
        <Legend
          verticalAlign="bottom"
          height={28}
          iconType="circle"
          formatter={(v) => (
            <span className="text-xs capitalize text-muted-foreground">{v}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// Generic horizontal bar for ranked lists.
export function HorizontalBar({
  data,
  nameKey,
  color = "var(--chart-2)",
}: {
  data: Record<string, string | number>[];
  nameKey: string;
  color?: string;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        No data for this month
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 44)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis
          type="number"
          tick={axisStyle}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatINRCompact}
        />
        <YAxis
          type="category"
          dataKey={nameKey}
          tick={axisStyle}
          tickLine={false}
          axisLine={false}
          width={140}
        />
        <Tooltip content={<TooltipBox />} cursor={{ fill: "var(--muted)" }} />
        <Bar dataKey="amount" name="Amount" fill={color} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
