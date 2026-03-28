import type { Bar, IndicatorData } from "./indicators";

export interface Trade {
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  returnPct: number;
  exitReason: string;
  bars: number;
}

export interface BacktestResult {
  trades: Trade[];
  totalReturn: number;
  winRate: number;
  maxDrawdown: number;
  totalTrades: number;
  sharpeRatio: number;
  avgWin: number;
  avgLoss: number;
  equityCurve: { date: string; equity: number }[];
  openTrade: { entryDate: string; entryPrice: number; entryIdx: number } | null;
}

function getNum(arr: (number | null)[], i: number): number {
  return (arr[i] as number) ?? 0;
}

function isNum(arr: (number | null)[], i: number): boolean {
  return arr[i] !== null && !Number.isNaN(arr[i]);
}

export function runBacktest(
  bars: Bar[],
  indicators: IndicatorData,
  startDate?: string,
  endDate?: string,
): BacktestResult {
  const { rsi, roc21, mfi, macd, momentum } = indicators;

  // Filter by date range
  let filteredBars = bars;
  let offset = 0;
  if (startDate || endDate) {
    const startIdx = startDate ? bars.findIndex((b) => b.date >= startDate) : 0;
    const endIdx = endDate
      ? bars.findIndex((b) => b.date > endDate)
      : bars.length;
    offset = startIdx >= 0 ? startIdx : 0;
    filteredBars = bars.slice(offset, endIdx >= 0 ? endIdx : bars.length);
  }

  const trades: Trade[] = [];
  let inPosition = false;
  let entryPrice = 0;
  let entryDate = "";
  let entryIdx = 0;
  let lastExitIdx: number | null = null;

  let equity = 100;
  const equityCurve: { date: string; equity: number }[] = [];
  let peak = equity;
  let maxDrawdown = 0;
  const dailyReturns: number[] = [];

  for (let fi = 0; fi < filteredBars.length; fi++) {
    const i = fi + offset;
    const bar = filteredBars[fi];

    if (!inPosition) {
      if (lastExitIdx === null) {
        // First entry — original logic: RSI cross ≥ 52, roc21 > 2, momentum > 0
        if (
          i >= 1 &&
          isNum(rsi, i) &&
          isNum(rsi, i - 1) &&
          isNum(roc21, i) &&
          isNum(momentum, i)
        ) {
          const rsiCross = getNum(rsi, i) >= 52 && getNum(rsi, i - 1) < 52;
          if (rsiCross && getNum(roc21, i) > 2 && getNum(momentum, i) > 0) {
            inPosition = true;
            entryPrice = bar.close;
            entryDate = bar.date;
            entryIdx = i;
          }
        }
      } else {
        // Re-entry after a previous exit — apply cooling-off + 3-condition rules
        const coolOffComplete = i >= lastExitIdx + 3;
        if (
          coolOffComplete &&
          isNum(roc21, i) &&
          isNum(rsi, i) &&
          isNum(mfi, i) &&
          getNum(roc21, i) > 0 &&
          getNum(rsi, i) > 50 &&
          getNum(mfi, i) > 45
        ) {
          inPosition = true;
          entryPrice = bar.close;
          entryDate = bar.date;
          entryIdx = i;
        }
      }
      equityCurve.push({
        date: bar.date,
        equity: Number.parseFloat(equity.toFixed(2)),
      });
    } else {
      // Check HOLD condition first
      const momentumDrop3 =
        i >= 3 && isNum(momentum, i) && isNum(momentum, i - 3)
          ? getNum(momentum, i - 3) - getNum(momentum, i)
          : 0;

      const hold =
        isNum(rsi, i) &&
        getNum(rsi, i) >= 48 &&
        isNum(roc21, i) &&
        getNum(roc21, i) > -5 &&
        momentumDrop3 <= 5;

      let exitReason = "";

      if (!hold) {
        // Rule 1: Profit-Take
        if (
          isNum(roc21, i) &&
          getNum(roc21, i) > 15 &&
          isNum(rsi, i) &&
          isNum(mfi, i) &&
          (getNum(rsi, i) > 75 || getNum(mfi, i) > 80)
        ) {
          exitReason = "Profit-Take";
        }
        // Rule 2: Momentum Collapse
        else if (
          i >= 2 &&
          isNum(roc21, i) &&
          getNum(roc21, i) < 0 &&
          isNum(momentum, i) &&
          isNum(momentum, i - 1) &&
          isNum(momentum, i - 2) &&
          getNum(momentum, i) < getNum(momentum, i - 1) &&
          getNum(momentum, i - 1) < getNum(momentum, i - 2) &&
          getNum(momentum, i - 2) - getNum(momentum, i) > 8
        ) {
          exitReason = "Momentum Collapse";
        }
        // Rule 3: RSI Divergence
        else if (
          i >= 2 &&
          isNum(rsi, i) &&
          getNum(rsi, i) > 72 &&
          getNum(rsi, i) < getNum(rsi, i - 1) &&
          getNum(rsi, i - 1) < getNum(rsi, i - 2) &&
          isNum(mfi, i) &&
          getNum(mfi, i) < 50
        ) {
          exitReason = "RSI Divergence";
        }
        // Rule 4: MACD+MFI
        else if (
          i >= 1 &&
          isNum(macd, i) &&
          getNum(macd, i) < 0 &&
          isNum(mfi, i) &&
          getNum(mfi, i) < 45 &&
          isNum(momentum, i) &&
          isNum(momentum, i - 1) &&
          getNum(momentum, i) < getNum(momentum, i - 1)
        ) {
          exitReason = "MACD+MFI Weak";
        }
        // Rule 5: Multi-Weak
        else if (
          isNum(roc21, i) &&
          getNum(roc21, i) < -3 &&
          isNum(rsi, i) &&
          isNum(mfi, i) &&
          (getNum(rsi, i) < 45 || getNum(mfi, i) < 45)
        ) {
          exitReason = "Multi-Weak";
        }
        // Rule 6: Hard Floor
        else if (isNum(roc21, i) && getNum(roc21, i) < -9) {
          exitReason = "Hard Floor";
        }
      }

      if (exitReason) {
        const exitPrice = bar.close;
        const retPct = ((exitPrice - entryPrice) / entryPrice) * 100;
        trades.push({
          entryDate,
          exitDate: bar.date,
          entryPrice,
          exitPrice,
          returnPct: Number.parseFloat(retPct.toFixed(2)),
          exitReason,
          bars: i - entryIdx,
        });

        const tradeReturn = retPct / 100;
        dailyReturns.push(tradeReturn);
        equity *= 1 + tradeReturn;
        if (equity > peak) peak = equity;
        const dd = ((peak - equity) / peak) * 100;
        if (dd > maxDrawdown) maxDrawdown = dd;

        inPosition = false;
        entryPrice = 0;
        lastExitIdx = i;
      }

      equityCurve.push({
        date: bar.date,
        equity: Number.parseFloat(equity.toFixed(2)),
      });
    }
  }

  // Compute stats
  const wins = trades.filter((t) => t.returnPct > 0);
  const losses = trades.filter((t) => t.returnPct <= 0);
  const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
  const avgWin =
    wins.length > 0
      ? wins.reduce((s, t) => s + t.returnPct, 0) / wins.length
      : 0;
  const avgLoss =
    losses.length > 0
      ? losses.reduce((s, t) => s + t.returnPct, 0) / losses.length
      : 0;

  const totalReturn = equity - 100;

  // Sharpe
  let sharpeRatio = 0;
  if (dailyReturns.length > 1) {
    const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const variance =
      dailyReturns.reduce((a, b) => a + (b - mean) ** 2, 0) /
      dailyReturns.length;
    const stdDev = Math.sqrt(variance);
    const riskFree = 0.02 / 252;
    sharpeRatio =
      stdDev > 0 ? ((mean - riskFree) / stdDev) * Math.sqrt(252) : 0;
  }

  const openTrade = inPosition ? { entryDate, entryPrice, entryIdx } : null;

  return {
    trades,
    totalReturn: Number.parseFloat(totalReturn.toFixed(2)),
    winRate: Number.parseFloat(winRate.toFixed(1)),
    maxDrawdown: Number.parseFloat(maxDrawdown.toFixed(2)),
    totalTrades: trades.length,
    sharpeRatio: Number.parseFloat(sharpeRatio.toFixed(2)),
    avgWin: Number.parseFloat(avgWin.toFixed(2)),
    avgLoss: Number.parseFloat(avgLoss.toFixed(2)),
    equityCurve,
    openTrade,
  };
}
