import type { Trade } from "../lib/backtest";

const REASON_COLORS: Record<string, string> = {
  "Profit-Take": "#33D17A",
  "Momentum Collapse": "#E25555",
  "RSI Divergence": "#F2994A",
  "MACD+MFI Weak": "#F2C94C",
  "Multi-Weak": "#EB5757",
  "Hard Floor": "#FF6B6B",
};

interface Props {
  trades: Trade[];
  openTrade: { entryDate: string; entryPrice: number } | null;
  currentPrice?: number;
}

export function TradesTable({ trades, openTrade, currentPrice }: Props) {
  const allTrades = [...trades].reverse();

  return (
    <div data-ocid="trades.table" className="overflow-auto max-h-80">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {[
              "Entry Date",
              "Exit Date",
              "Entry $",
              "Exit $",
              "Return",
              "Days",
              "Exit Reason",
            ].map((h) => (
              <th
                key={h}
                className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-3 font-medium"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {openTrade && (
            <tr className="border-b border-border bg-accent/5">
              <td className="py-2 px-3 text-teal font-medium">
                {openTrade.entryDate}
              </td>
              <td className="py-2 px-3 text-muted-foreground italic">Open</td>
              <td className="py-2 px-3">${openTrade.entryPrice.toFixed(2)}</td>
              <td className="py-2 px-3 text-muted-foreground">
                {currentPrice ? `$${currentPrice.toFixed(2)}` : "—"}
              </td>
              <td className="py-2 px-3">
                {currentPrice ? (
                  <span
                    className={
                      currentPrice >= openTrade.entryPrice
                        ? "text-positive"
                        : "text-negative"
                    }
                  >
                    {(
                      ((currentPrice - openTrade.entryPrice) /
                        openTrade.entryPrice) *
                      100
                    ).toFixed(2)}
                    %
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="py-2 px-3 text-muted-foreground">—</td>
              <td className="py-2 px-3">
                <span
                  className="text-[11px] px-2 py-0.5 rounded-full border"
                  style={{ color: "#27C7C7", borderColor: "#27C7C7" }}
                >
                  In Trade
                </span>
              </td>
            </tr>
          )}
          {allTrades.map((trade, i) => (
            <tr
              key={`${trade.entryDate}-${i}`}
              data-ocid={`trades.row.${allTrades.length - i}`}
              className="border-b border-border hover:bg-card/60 transition-colors"
            >
              <td className="py-2 px-3 text-foreground">{trade.entryDate}</td>
              <td className="py-2 px-3 text-foreground">{trade.exitDate}</td>
              <td className="py-2 px-3">${trade.entryPrice.toFixed(2)}</td>
              <td className="py-2 px-3">${trade.exitPrice.toFixed(2)}</td>
              <td
                className={`py-2 px-3 font-semibold ${
                  trade.returnPct >= 0 ? "text-positive" : "text-negative"
                }`}
              >
                {trade.returnPct >= 0 ? "+" : ""}
                {trade.returnPct}%
              </td>
              <td className="py-2 px-3 text-muted-foreground">{trade.bars}d</td>
              <td className="py-2 px-3">
                <span
                  className="text-[11px] px-2 py-0.5 rounded-full border"
                  style={{
                    color: REASON_COLORS[trade.exitReason] ?? "#A0A4AA",
                    borderColor: REASON_COLORS[trade.exitReason] ?? "#2A2B2E",
                  }}
                >
                  {trade.exitReason}
                </span>
              </td>
            </tr>
          ))}
          {allTrades.length === 0 && !openTrade && (
            <tr>
              <td
                data-ocid="trades.empty_state"
                colSpan={7}
                className="py-8 text-center text-muted-foreground text-sm"
              >
                No completed trades in selected period
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
