import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { Trade } from "../lib/backtest";
import type { Bar } from "../lib/indicators";

interface Props {
  bars: Bar[];
  trades: Trade[];
  openTrade: { entryDate: string; entryPrice: number } | null;
  startDate: string;
  endDate: string;
}

interface ChartPoint {
  date: string;
  close: number;
  entry?: number;
  exit?: number;
  openEntry?: number;
}

const CustomDot = (props: {
  cx?: number;
  cy?: number;
  value?: number;
  type: "entry" | "exit" | "openEntry";
}) => {
  const { cx, cy, value, type } = props;
  if (!value || cx === undefined || cy === undefined) return null;
  if (type === "entry") {
    return (
      <polygon
        points={`${cx},${cy - 8} ${cx - 6},${cy + 4} ${cx + 6},${cy + 4}`}
        fill="#33D17A"
        stroke="#33D17A"
      />
    );
  }
  if (type === "exit") {
    return (
      <polygon
        points={`${cx},${cy + 8} ${cx - 6},${cy - 4} ${cx + 6},${cy - 4}`}
        fill="#E25555"
        stroke="#E25555"
      />
    );
  }
  // openEntry
  return (
    <polygon
      points={`${cx},${cy - 8} ${cx - 6},${cy + 4} ${cx + 6},${cy + 4}`}
      fill="#27C7C7"
      stroke="#27C7C7"
    />
  );
};

export function PriceChart({
  bars,
  trades,
  openTrade,
  startDate,
  endDate,
}: Props) {
  const filtered = bars.filter((b) => b.date >= startDate && b.date <= endDate);

  const entryDates = new Set(trades.map((t) => t.entryDate));
  const exitDates = new Set(trades.map((t) => t.exitDate));

  const data: ChartPoint[] = filtered.map((b) => ({
    date: b.date,
    close: b.close,
    entry: entryDates.has(b.date) ? b.close : undefined,
    exit: exitDates.has(b.date) ? b.close : undefined,
    openEntry: openTrade?.entryDate === b.date ? b.close : undefined,
  }));

  const closes = filtered.map((b) => b.close);
  const minClose = Math.min(...closes) * 0.995;
  const maxClose = Math.max(...closes) * 1.005;

  const tickInterval = Math.floor(filtered.length / 6);

  return (
    <div data-ocid="price.chart" className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#2A2B2E" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#A0A4AA", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "#2A2B2E" }}
            interval={tickInterval}
          />
          <YAxis
            domain={[minClose, maxClose]}
            tick={{ fill: "#A0A4AA", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `$${v.toFixed(0)}`}
            width={55}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#202124",
              border: "1px solid #2A2B2E",
              borderRadius: "8px",
              color: "#EDEDED",
              fontSize: 12,
            }}
            formatter={(value: number, name: string) => {
              if (name === "close") return [`$${value.toFixed(2)}`, "Price"];
              return [value, name];
            }}
          />
          <Line
            type="monotone"
            dataKey="close"
            stroke="#27C7C7"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="entry"
            stroke="transparent"
            dot={(props) => <CustomDot {...props} type="entry" />}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="exit"
            stroke="transparent"
            dot={(props) => <CustomDot {...props} type="exit" />}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="openEntry"
            stroke="transparent"
            dot={(props) => <CustomDot {...props} type="openEntry" />}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Mini equity curve chart
interface EquityCurveProps {
  data: { date: string; equity: number }[];
}

export function EquityCurveChart({ data }: EquityCurveProps) {
  const values = data.map((d) => d.equity);
  const minV = Math.min(...values) * 0.995;
  const maxV = Math.max(...values) * 1.005;
  const tickInterval = Math.floor(data.length / 5);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2A2B2E" />
        <XAxis
          dataKey="date"
          tick={{ fill: "#A0A4AA", fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: "#2A2B2E" }}
          interval={tickInterval}
        />
        <YAxis
          domain={[minV, maxV]}
          tick={{ fill: "#A0A4AA", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v.toFixed(0)}`}
          width={45}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#202124",
            border: "1px solid #2A2B2E",
            borderRadius: "8px",
            color: "#EDEDED",
            fontSize: 12,
          }}
          formatter={(v: number) => [`${v.toFixed(2)}`, "Equity"]}
        />
        <ReferenceLine y={100} stroke="#2A2B2E" strokeDasharray="3 3" />
        <Line
          type="monotone"
          dataKey="equity"
          stroke="#33D17A"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
