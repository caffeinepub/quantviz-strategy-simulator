import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DayData, TradeRecord } from "../../lib/playback";

interface ChartTabProps {
  data: DayData[];
  currentDay: number;
  openTrade: TradeRecord | null;
  completedTrades: TradeRecord[];
  alertDays: number[];
}

export function ChartTab({
  data,
  currentDay,
  openTrade,
  completedTrades,
  alertDays,
}: ChartTabProps) {
  const visible = data.slice(0, currentDay + 1);
  const priceData = visible.map((r, i) => ({
    day: i + 1,
    price: r.price,
    roc21: r.roc21,
  }));

  const ttStyle = {
    background: "oklch(0.11 0.008 250)",
    border: "1px solid oklch(0.22 0.01 250)",
    borderRadius: 4,
    fontSize: 11,
  };

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-primary inline-block" /> Price
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-positive inline-block" /> Entry
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-negative inline-block" /> Exit
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-warning inline-block" /> Alert
        </span>
      </div>

      {/* Price chart */}
      <div className="bg-card border border-border rounded-lg p-3">
        <p className="text-xs text-muted-foreground mb-2">Price Series</p>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={priceData}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="oklch(0.22 0.01 250)"
            />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 10, fill: "oklch(0.52 0.01 250)" }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "oklch(0.52 0.01 250)" }}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={ttStyle}
              labelFormatter={(v) => `Day ${v}`}
              formatter={(v: number) => [`$${v.toFixed(2)}`, "Price"]}
            />

            {openTrade && (
              <ReferenceLine
                x={openTrade.entryDay + 1}
                stroke="oklch(0.72 0.18 140)"
                strokeDasharray="4 2"
                label={{
                  value: "E",
                  fill: "oklch(0.72 0.18 140)",
                  fontSize: 9,
                }}
              />
            )}
            {completedTrades.flatMap((t, i) => [
              <ReferenceLine
                key={`entry-${i}-${t.entryDay}`}
                x={t.entryDay + 1}
                stroke="oklch(0.72 0.18 140)"
                strokeDasharray="4 2"
              />,
              t.exitDay !== undefined ? (
                <ReferenceLine
                  key={`exit-${i}-${t.exitDay}`}
                  x={t.exitDay + 1}
                  stroke="oklch(0.65 0.22 25)"
                  strokeDasharray="4 2"
                />
              ) : null,
            ])}
            {alertDays.slice(-10).map((d) => (
              <ReferenceLine
                key={`alert-day-${d}`}
                x={d + 1}
                stroke="oklch(0.78 0.18 75)"
                strokeOpacity={0.4}
              />
            ))}

            <Line
              type="monotone"
              dataKey="price"
              stroke="oklch(0.72 0.15 195)"
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ROC21 chart */}
      <div className="bg-card border border-border rounded-lg p-3">
        <p className="text-xs text-muted-foreground mb-2">ROC21 (%)</p>
        <ResponsiveContainer width="100%" height={192}>
          <LineChart data={priceData}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="oklch(0.22 0.01 250)"
            />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 10, fill: "oklch(0.52 0.01 250)" }}
            />
            <YAxis tick={{ fontSize: 10, fill: "oklch(0.52 0.01 250)" }} />
            <Tooltip
              contentStyle={ttStyle}
              labelFormatter={(v) => `Day ${v}`}
              formatter={(v: number) => [`${v.toFixed(2)}%`, "ROC21"]}
            />
            <ReferenceLine y={0} stroke="oklch(0.52 0.01 250)" />
            <ReferenceLine
              y={-5}
              stroke="oklch(0.78 0.18 75)"
              strokeDasharray="4 2"
              label={{ value: "-5", fill: "oklch(0.78 0.18 75)", fontSize: 9 }}
            />
            <ReferenceLine
              y={-9}
              stroke="oklch(0.65 0.22 25)"
              strokeDasharray="4 2"
              label={{ value: "-9", fill: "oklch(0.65 0.22 25)", fontSize: 9 }}
            />
            <ReferenceLine
              y={15}
              stroke="oklch(0.72 0.18 140)"
              strokeDasharray="4 2"
              label={{ value: "15", fill: "oklch(0.72 0.18 140)", fontSize: 9 }}
            />
            <Line
              type="monotone"
              dataKey="roc21"
              stroke="oklch(0.72 0.18 140)"
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
