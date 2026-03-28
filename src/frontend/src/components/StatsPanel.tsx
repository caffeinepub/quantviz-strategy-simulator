import type { BacktestResult } from "../lib/backtest";

interface Props {
  result: BacktestResult;
}

interface StatTile {
  label: string;
  value: string;
  positive?: boolean | null;
}

export function StatsPanel({ result }: Props) {
  const tiles: StatTile[] = [
    {
      label: "Total Return",
      value: `${result.totalReturn >= 0 ? "+" : ""}${result.totalReturn}%`,
      positive: result.totalReturn >= 0,
    },
    {
      label: "Win Rate",
      value: `${result.winRate}%`,
      positive: result.winRate >= 50,
    },
    {
      label: "Max Drawdown",
      value: `${result.maxDrawdown.toFixed(2)}%`,
      positive: result.maxDrawdown < 10,
    },
    {
      label: "Total Trades",
      value: String(result.totalTrades),
      positive: null,
    },
    {
      label: "Sharpe Ratio",
      value: String(result.sharpeRatio),
      positive: result.sharpeRatio >= 1,
    },
    {
      label: "Avg Win",
      value: `${result.avgWin >= 0 ? "+" : ""}${result.avgWin}%`,
      positive: true,
    },
    {
      label: "Avg Loss",
      value: `${result.avgLoss}%`,
      positive: false,
    },
  ];

  return (
    <div data-ocid="stats.panel" className="flex flex-wrap gap-3">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="flex-1 min-w-[110px] bg-card border border-border rounded-lg px-4 py-3"
        >
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">
            {tile.label}
          </div>
          <div
            className={`text-lg font-semibold ${
              tile.positive === null
                ? "text-foreground"
                : tile.positive
                  ? "text-positive"
                  : "text-negative"
            }`}
          >
            {tile.value}
          </div>
        </div>
      ))}
    </div>
  );
}
