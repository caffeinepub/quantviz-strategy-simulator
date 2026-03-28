import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface DataPoint {
  date: string;
  value: number | null;
  value2?: number | null;
  hist?: number | null;
}

interface IndicatorPanelProps {
  title: string;
  data: DataPoint[];
  color: string;
  refLines?: number[];
  isMACD?: boolean;
  yDomain?: [number | string, number | string];
}

export function IndicatorPanel({
  title,
  data,
  color,
  refLines = [],
  isMACD = false,
  yDomain,
}: IndicatorPanelProps) {
  const validValues = data
    .map((d) => d.value)
    .filter((v): v is number => v !== null && !Number.isNaN(v));

  const minV = yDomain
    ? undefined
    : validValues.length
      ? Math.min(...validValues) * 1.05
      : 0;
  const maxV = yDomain
    ? undefined
    : validValues.length
      ? Math.max(...validValues) * 1.05
      : 100;
  const domain = yDomain ?? [minV as number, maxV as number];

  const tickInterval = Math.floor(data.length / 5);

  if (isMACD) {
    return (
      <div className="w-full h-full">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 px-2">
          {title}
        </div>
        <ResponsiveContainer width="100%" height="calc(100% - 20px)">
          <BarChart
            data={data}
            margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#2A2B2E" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#A0A4AA", fontSize: 9 }}
              tickLine={false}
              axisLine={{ stroke: "#2A2B2E" }}
              interval={tickInterval}
            />
            <YAxis
              tick={{ fill: "#A0A4AA", fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              width={40}
              tickFormatter={(v) => v.toFixed(1)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#202124",
                border: "1px solid #2A2B2E",
                borderRadius: "8px",
                color: "#EDEDED",
                fontSize: 11,
              }}
            />
            <ReferenceLine y={0} stroke="#2A2B2E" />
            <Bar dataKey="hist" name="Histogram">
              {data.map((entry) => (
                <Cell
                  key={entry.date}
                  fill={(entry.hist ?? 0) >= 0 ? "#33D17A" : "#E25555"}
                />
              ))}
            </Bar>
            <Line
              type="monotone"
              dataKey="value"
              stroke="#27C7C7"
              strokeWidth={1}
              dot={false}
              name="MACD"
            />
            <Line
              type="monotone"
              dataKey="value2"
              stroke="#F2994A"
              strokeWidth={1}
              dot={false}
              name="Signal"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 px-2">
        {title}
      </div>
      <ResponsiveContainer width="100%" height="calc(100% - 20px)">
        <LineChart
          data={data}
          margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#2A2B2E" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#A0A4AA", fontSize: 9 }}
            tickLine={false}
            axisLine={{ stroke: "#2A2B2E" }}
            interval={tickInterval}
          />
          <YAxis
            domain={domain}
            tick={{ fill: "#A0A4AA", fontSize: 9 }}
            tickLine={false}
            axisLine={false}
            width={40}
            tickFormatter={(v) => v.toFixed(1)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#202124",
              border: "1px solid #2A2B2E",
              borderRadius: "8px",
              color: "#EDEDED",
              fontSize: 11,
            }}
            formatter={(v: number) => [v.toFixed(2), title]}
          />
          {refLines.map((rl) => (
            <ReferenceLine
              key={rl}
              y={rl}
              stroke="#2A2B2E"
              strokeDasharray="3 3"
            />
          ))}
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
