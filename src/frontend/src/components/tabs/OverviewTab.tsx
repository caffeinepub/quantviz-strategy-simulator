import { BarChart2, TrendingDown, TrendingUp, Zap } from "lucide-react";
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
import { IndicatorDetailCard } from "../IndicatorDetailCard";

interface OverviewTabProps {
  data: DayData[];
  currentDay: number;
  openTrade: TradeRecord | null;
}

function fmtV(v: number | null, d = 2) {
  if (v === null) return "—";
  return v.toFixed(d);
}

export function OverviewTab({ data, currentDay, openTrade }: OverviewTabProps) {
  const d = data[currentDay];
  const visible = data.slice(0, currentDay + 1);

  const chartData = visible.map((row, i) => ({
    day: i + 1,
    price: row.price,
  }));

  const stats = d
    ? [
        {
          label: "PRICE",
          value: `$${fmtV(d.price)}`,
          bgStyle: {
            background: "oklch(0.76 0.19 195 / 0.10)",
            borderColor: "oklch(0.76 0.19 195 / 0.30)",
          },
          valueStyle: { color: "oklch(0.76 0.19 195)" },
        },
        {
          label: "ROC21",
          value: `${d.roc21 >= 0 ? "+" : ""}${fmtV(d.roc21)}%`,
          bgStyle:
            d.roc21 >= 0
              ? {
                  background: "oklch(0.78 0.22 145 / 0.10)",
                  borderColor: "oklch(0.78 0.22 145 / 0.30)",
                }
              : {
                  background: "oklch(0.65 0.26 25 / 0.10)",
                  borderColor: "oklch(0.65 0.26 25 / 0.30)",
                },
          valueStyle: {
            color:
              d.roc21 >= 0 ? "oklch(0.78 0.22 145)" : "oklch(0.65 0.26 25)",
            textShadow:
              d.roc21 >= 0
                ? "0 0 8px oklch(0.78 0.22 145 / 0.5)"
                : "0 0 8px oklch(0.65 0.26 25 / 0.5)",
          },
        },
        {
          label: "MFI",
          value: fmtV(d.mfi, 1),
          bgStyle:
            d.mfi > 80
              ? {
                  background: "oklch(0.65 0.26 25 / 0.12)",
                  borderColor: "oklch(0.65 0.26 25 / 0.35)",
                }
              : d.mfi < 45
                ? {
                    background: "oklch(0.65 0.26 25 / 0.08)",
                    borderColor: "oklch(0.65 0.26 25 / 0.25)",
                  }
                : {
                    background: "oklch(0.84 0.20 75 / 0.08)",
                    borderColor: "oklch(0.84 0.20 75 / 0.25)",
                  },
          valueStyle: {
            color:
              d.mfi > 80
                ? "oklch(0.65 0.26 25)"
                : d.mfi < 45
                  ? "oklch(0.65 0.26 25)"
                  : "oklch(0.84 0.20 75)",
          },
        },
        {
          label: "RSI",
          value: fmtV(d.rsi, 1),
          bgStyle:
            d.rsi > 75
              ? {
                  background: "oklch(0.65 0.26 25 / 0.12)",
                  borderColor: "oklch(0.65 0.26 25 / 0.35)",
                }
              : d.rsi < 48
                ? {
                    background: "oklch(0.65 0.26 25 / 0.08)",
                    borderColor: "oklch(0.65 0.26 25 / 0.25)",
                  }
                : {
                    background: "oklch(0.65 0.20 285 / 0.10)",
                    borderColor: "oklch(0.65 0.20 285 / 0.30)",
                  },
          valueStyle: {
            color:
              d.rsi > 75
                ? "oklch(0.65 0.26 25)"
                : d.rsi < 48
                  ? "oklch(0.65 0.26 25)"
                  : "oklch(0.65 0.20 285)",
          },
        },
        {
          label: "MACD",
          value: fmtV(d.macd),
          bgStyle:
            d.macd >= 0
              ? {
                  background: "oklch(0.78 0.22 145 / 0.10)",
                  borderColor: "oklch(0.78 0.22 145 / 0.30)",
                }
              : {
                  background: "oklch(0.65 0.26 25 / 0.08)",
                  borderColor: "oklch(0.65 0.26 25 / 0.25)",
                },
          valueStyle: {
            color: d.macd >= 0 ? "oklch(0.78 0.22 145)" : "oklch(0.65 0.26 25)",
            textShadow:
              d.macd >= 0
                ? "0 0 8px oklch(0.78 0.22 145 / 0.4)"
                : "0 0 8px oklch(0.65 0.26 25 / 0.4)",
          },
        },
      ]
    : [];

  const rsiStatus = !d
    ? "OK"
    : d.rsi > 75
      ? "ALERT"
      : d.rsi < 45
        ? "WARNING"
        : "OK";
  const macdStatus = !d
    ? "OK"
    : d.macd < 0 && d.mfi < 45
      ? "ALERT"
      : d.macd < 0
        ? "WARNING"
        : "OK";
  const mfiStatus = !d
    ? "OK"
    : d.mfi > 80
      ? "ALERT"
      : d.mfi < 45
        ? "WARNING"
        : "OK";
  const momStatus = !d
    ? "OK"
    : currentDay >= 3
      ? data[currentDay - 3].momentum - d.momentum > 8
        ? "ALERT"
        : "OK"
      : "OK";

  return (
    <div className="space-y-4">
      {/* Stat chips */}
      {d && (
        <div className="flex flex-wrap gap-2">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-center px-4 py-2 rounded-xl border min-w-[80px] transition-all"
              style={s.bgStyle}
            >
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                {s.label}
              </span>
              <span
                className="text-sm font-mono font-bold"
                style={s.valueStyle}
              >
                {s.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Mini price chart */}
      <div
        className="rounded-xl p-3"
        style={{
          background: "oklch(0.17 0.045 258)",
          border: "1px solid oklch(0.28 0.06 258)",
        }}
      >
        <p className="text-xs text-muted-foreground mb-2">Price</p>
        <ResponsiveContainer width="100%" height={192}>
          <LineChart data={chartData}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="oklch(0.24 0.05 260)"
            />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 10, fill: "oklch(0.62 0.04 255)" }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "oklch(0.62 0.04 255)" }}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{
                background: "oklch(0.15 0.05 262)",
                border: "1px solid oklch(0.76 0.19 195 / 0.3)",
                borderRadius: 8,
                fontSize: 11,
                boxShadow: "0 4px 24px oklch(0.76 0.19 195 / 0.15)",
              }}
              labelFormatter={(v) => `Day ${v}`}
              formatter={(v: number) => [`$${v.toFixed(2)}`, "Price"]}
            />
            {openTrade && (
              <ReferenceLine
                x={openTrade.entryDay + 1}
                stroke="oklch(0.78 0.22 145)"
                strokeDasharray="4 2"
                label={{
                  value: "Entry",
                  fill: "oklch(0.78 0.22 145)",
                  fontSize: 10,
                }}
              />
            )}
            <Line
              type="monotone"
              dataKey="price"
              stroke="oklch(0.76 0.19 195)"
              strokeWidth={2}
              dot={false}
              style={{
                filter: "drop-shadow(0 0 4px oklch(0.76 0.19 195 / 0.6))",
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Indicator cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <IndicatorDetailCard
          title="RSI (14)"
          icon={<TrendingUp size={12} />}
          value={d?.rsi ?? null}
          status={rsiStatus}
          min={0}
          max={100}
          thresholds={[
            { value: 75, color: "#ef4444", label: "Overbought" },
            { value: 52, color: "#22d3ee", label: "Entry" },
            { value: 48, color: "#f59e0b", label: "Hold" },
            { value: 45, color: "#ef4444", label: "Weak" },
          ]}
          color="oklch(0.76 0.19 195)"
          description="Entry at RSI≥52 cross. Hold if RSI≥48. Exit triggers at RSI>72 divergence."
        />
        <IndicatorDetailCard
          title="MACD"
          icon={<BarChart2 size={12} />}
          value={d?.macd ?? null}
          status={macdStatus}
          min={-5}
          max={5}
          thresholds={[{ value: 0, color: "#94a3b8", label: "Zero" }]}
          color="oklch(0.65 0.26 25)"
          description="MACD<0 with MFI<45 triggers MACD+MFI exit rule."
        />
        <IndicatorDetailCard
          title="MFI (14)"
          icon={<Zap size={12} />}
          value={d?.mfi ?? null}
          status={mfiStatus}
          min={0}
          max={100}
          thresholds={[
            { value: 80, color: "#ef4444", label: "Overbought" },
            { value: 50, color: "#94a3b8", label: "Mid" },
            { value: 45, color: "#f59e0b", label: "Weak" },
          ]}
          color="oklch(0.84 0.20 75)"
          description="MFI>80 confirms Profit-Take. MFI<45 contributes to MACD+MFI and Multi-Weak exits."
        />
        <IndicatorDetailCard
          title="Momentum"
          icon={<TrendingDown size={12} />}
          value={d?.momentum ?? null}
          status={momStatus}
          min={-20}
          max={20}
          thresholds={[{ value: 0, color: "#94a3b8", label: "Zero" }]}
          color="oklch(0.78 0.22 145)"
          description="3-day drop >8pts triggers Momentum Collapse. Hold skipped if drop ≤5pts."
        />
      </div>
    </div>
  );
}
