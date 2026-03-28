import type { TradeRecord } from "../lib/playback";

interface TradesSummaryProps {
  completedTrades: TradeRecord[];
  openTrade: TradeRecord | null;
  currentPrice: number | null;
}

export function TradesSummary({
  completedTrades,
  openTrade,
  currentPrice,
}: TradesSummaryProps) {
  const wins = completedTrades.filter((t) => (t.pnlPct ?? 0) > 0).length;
  const losses = completedTrades.filter((t) => (t.pnlPct ?? 0) <= 0).length;

  const completedEquity = completedTrades.reduce(
    (eq, t) => eq * (1 + (t.pnlPct ?? 0) / 100),
    100,
  );

  const openPnlPct =
    openTrade && currentPrice
      ? ((currentPrice - openTrade.entryPrice) / openTrade.entryPrice) * 100
      : null;

  const compoundedEquity =
    openPnlPct !== null
      ? completedEquity * (1 + openPnlPct / 100)
      : completedEquity;

  const totalReturn = compoundedEquity - 100;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "oklch(0.17 0.045 258)",
        border: "1px solid oklch(0.28 0.06 258)",
        boxShadow: "0 4px 24px oklch(0.76 0.19 195 / 0.06)",
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-2.5 flex items-center gap-2"
        style={{
          background:
            "linear-gradient(90deg, oklch(0.76 0.19 195 / 0.12) 0%, oklch(0.65 0.20 285 / 0.08) 100%)",
          borderBottom: "1px solid oklch(0.28 0.06 258)",
        }}
      >
        <div
          className="w-1.5 h-4 rounded-full"
          style={{
            background:
              "linear-gradient(180deg, oklch(0.76 0.19 195) 0%, oklch(0.65 0.20 285) 100%)",
          }}
        />
        <span className="text-xs font-semibold text-foreground">
          Trade Summary
        </span>
      </div>

      {/* Top stats */}
      <div
        className="grid grid-cols-4 divide-x"
        style={{ borderColor: "oklch(0.28 0.06 258)" }}
      >
        {[
          { label: "Total", value: completedTrades.length, style: {} },
          {
            label: "Wins",
            value: wins,
            style: {
              color: "oklch(0.78 0.22 145)",
              textShadow: "0 0 10px oklch(0.78 0.22 145 / 0.5)",
            },
          },
          {
            label: "Losses",
            value: losses,
            style: {
              color: "oklch(0.65 0.26 25)",
              textShadow: "0 0 10px oklch(0.65 0.26 25 / 0.5)",
            },
          },
          {
            label: "Win Rate",
            value:
              completedTrades.length > 0
                ? `${((wins / completedTrades.length) * 100).toFixed(0)}%`
                : "\u2014",
            style:
              wins > losses
                ? {
                    color: "oklch(0.78 0.22 145)",
                    textShadow: "0 0 10px oklch(0.78 0.22 145 / 0.4)",
                  }
                : {
                    color: "oklch(0.65 0.26 25)",
                    textShadow: "0 0 10px oklch(0.65 0.26 25 / 0.4)",
                  },
          },
        ].map((s) => (
          <div
            key={s.label}
            className="flex flex-col items-center py-3 gap-0.5"
          >
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
              {s.label}
            </span>
            <span
              className="text-lg font-mono font-bold text-foreground"
              style={s.style}
            >
              {s.value}
            </span>
          </div>
        ))}
      </div>

      {/* Equity + Return */}
      <div
        className="grid grid-cols-2 divide-x"
        style={{
          borderTop: "1px solid oklch(0.28 0.06 258)",
          borderColor: "oklch(0.28 0.06 258)",
        }}
      >
        <div
          className="flex flex-col items-center py-3 gap-0.5"
          style={{ background: "oklch(0.76 0.19 195 / 0.05)" }}
        >
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
            Final Equity
          </span>
          <span
            className="text-sm font-mono font-bold"
            style={{
              color: "oklch(0.76 0.19 195)",
              textShadow: "0 0 10px oklch(0.76 0.19 195 / 0.4)",
            }}
          >
            ${compoundedEquity.toFixed(2)}
          </span>
          <span className="text-[9px] text-muted-foreground">
            {openPnlPct !== null ? "(incl. open trade)" : "(started at $100)"}
          </span>
        </div>
        <div
          className="flex flex-col items-center py-3 gap-0.5"
          style={{
            background:
              totalReturn >= 0
                ? "oklch(0.78 0.22 145 / 0.06)"
                : "oklch(0.65 0.26 25 / 0.06)",
          }}
        >
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
            Total Return
          </span>
          <span
            className="text-sm font-mono font-bold"
            style={{
              color:
                totalReturn >= 0
                  ? "oklch(0.78 0.22 145)"
                  : "oklch(0.65 0.26 25)",
              textShadow:
                totalReturn >= 0
                  ? "0 0 12px oklch(0.78 0.22 145 / 0.6)"
                  : "0 0 12px oklch(0.65 0.26 25 / 0.6)",
            }}
          >
            {totalReturn >= 0 ? "+" : ""}
            {totalReturn.toFixed(2)}%
          </span>
          {openPnlPct !== null && (
            <span className="text-[9px] text-muted-foreground">
              (incl. open)
            </span>
          )}
        </div>
      </div>

      {/* Trades table */}
      {(completedTrades.length > 0 || (openTrade && currentPrice)) && (
        <div
          style={{ borderTop: "1px solid oklch(0.28 0.06 258)" }}
          className="overflow-x-auto"
        >
          <table className="w-full text-[10px]">
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid oklch(0.28 0.06 258)",
                  background: "oklch(0.15 0.04 260)",
                }}
              >
                {[
                  "#",
                  "Entry Day",
                  "Entry $",
                  "Exit Day",
                  "Exit $",
                  "Reason",
                  "P&L",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-1.5 text-left font-medium whitespace-nowrap"
                    style={{ color: "oklch(0.62 0.04 255)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {completedTrades.slice(-10).map((t, i) => (
                <tr
                  key={`trade-${t.entryDay}-${t.exitDay ?? "open"}`}
                  className="transition-colors hover:bg-white/[0.02]"
                  style={{
                    borderBottom: "1px solid oklch(0.22 0.05 260 / 0.6)",
                  }}
                  data-ocid={`trades.item.${i + 1}`}
                >
                  <td className="px-3 py-1.5 font-mono text-muted-foreground">
                    {completedTrades.length - 10 + i + 1}
                  </td>
                  <td className="px-3 py-1.5 font-mono">{t.entryDay + 1}</td>
                  <td className="px-3 py-1.5 font-mono">
                    ${t.entryPrice.toFixed(2)}
                  </td>
                  <td className="px-3 py-1.5 font-mono">
                    {t.exitDay !== undefined ? t.exitDay + 1 : "\u2014"}
                  </td>
                  <td className="px-3 py-1.5 font-mono">
                    {t.exitPrice !== undefined
                      ? `$${t.exitPrice.toFixed(2)}`
                      : "\u2014"}
                  </td>
                  <td
                    className="px-3 py-1.5 font-mono"
                    style={{ color: "oklch(0.62 0.04 255)" }}
                  >
                    {t.exitReason ?? "\u2014"}
                  </td>
                  <td
                    className="px-3 py-1.5 font-mono font-bold"
                    style={{
                      color:
                        (t.pnlPct ?? 0) >= 0
                          ? "oklch(0.78 0.22 145)"
                          : "oklch(0.65 0.26 25)",
                      textShadow:
                        (t.pnlPct ?? 0) >= 0
                          ? "0 0 8px oklch(0.78 0.22 145 / 0.5)"
                          : "0 0 8px oklch(0.65 0.26 25 / 0.5)",
                    }}
                  >
                    {t.pnlPct !== undefined
                      ? `${t.pnlPct >= 0 ? "+" : ""}${t.pnlPct.toFixed(2)}%`
                      : "\u2014"}
                  </td>
                </tr>
              ))}
              {openTrade && currentPrice && openPnlPct !== null && (
                <tr
                  style={{
                    background: "oklch(0.76 0.19 195 / 0.07)",
                    borderBottom: "1px solid oklch(0.76 0.19 195 / 0.2)",
                  }}
                >
                  <td
                    className="px-3 py-1.5 font-mono font-bold"
                    style={{ color: "oklch(0.76 0.19 195)" }}
                  >
                    OPEN
                  </td>
                  <td className="px-3 py-1.5 font-mono">
                    {openTrade.entryDay + 1}
                  </td>
                  <td className="px-3 py-1.5 font-mono">
                    ${openTrade.entryPrice.toFixed(2)}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-muted-foreground">
                    \u2014
                  </td>
                  <td className="px-3 py-1.5 font-mono">
                    ${currentPrice.toFixed(2)}
                  </td>
                  <td
                    className="px-3 py-1.5 font-mono"
                    style={{ color: "oklch(0.76 0.19 195)" }}
                  >
                    Active
                  </td>
                  <td
                    className="px-3 py-1.5 font-mono font-bold"
                    style={{
                      color:
                        openPnlPct >= 0
                          ? "oklch(0.78 0.22 145)"
                          : "oklch(0.65 0.26 25)",
                      textShadow:
                        openPnlPct >= 0
                          ? "0 0 10px oklch(0.78 0.22 145 / 0.6)"
                          : "0 0 10px oklch(0.65 0.26 25 / 0.6)",
                    }}
                  >
                    {`${openPnlPct >= 0 ? "+" : ""}${openPnlPct.toFixed(2)}%`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
