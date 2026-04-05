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

/**
 * Compute rolling percentile over a window ending at index i.
 * Uses all available valid values in the window — no minimum row requirement.
 * Returns null only if there are zero valid values.
 */
function rollingPercentile(
  arr: (number | null)[],
  i: number,
  windowSize: number,
  pct: number,
): number | null {
  const slice: number[] = [];
  for (let j = Math.max(0, i - windowSize + 1); j <= i; j++) {
    if (arr[j] !== null && !Number.isNaN(arr[j])) slice.push(arr[j] as number);
  }
  if (slice.length === 0) return null;
  slice.sort((a, b) => a - b);
  const idx = Math.floor(pct * (slice.length - 1));
  return slice[idx];
}

export function runBacktest(
  bars: Bar[],
  indicators: IndicatorData,
  startDate?: string,
  endDate?: string,
): BacktestResult {
  const { rsi, roc21, mfi, macd } = indicators;

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

  // --- Divergence-Decay Exit Protocol state ---
  let alphaPeakIdx: number | null = null;
  let alphaPeakPrice: number | null = null;
  let alphaPeakRSI: number | null = null;
  let alphaPeakMACD: number | null = null;

  for (let fi = 0; fi < filteredBars.length; fi++) {
    const i = fi + offset;
    const bar = filteredBars[fi];

    if (!inPosition) {
      if (lastExitIdx === null) {
        // First entry — use first bar as auto-entry
        if (fi === 0) {
          inPosition = true;
          entryPrice = bar.close;
          entryDate = bar.date;
          entryIdx = i;
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
          // Reset alpha peak for the new trade
          alphaPeakIdx = null;
          alphaPeakPrice = null;
          alphaPeakRSI = null;
          alphaPeakMACD = null;
        }
      }
      equityCurve.push({
        date: bar.date,
        equity: Number.parseFloat(equity.toFixed(2)),
      });
    } else {
      // --- Divergence-Decay Exit Protocol ---

      // Dynamic upper threshold = rolling 85th percentile (window 50)
      const T_RSI_upper = rollingPercentile(rsi, i, 50, 0.85);
      const T_MFI_upper = rollingPercentile(mfi, i, 50, 0.85);

      // Rule Zero: AVOID — both RSI and MFI are at or below their adaptive upper thresholds
      // I_avoid(t) = RSI(t) <= T_RSI_upper(t) AND MFI(t) <= T_MFI_upper(t)
      // (computed but used only for state reporting; does not block the existing trade)
      void (
        (T_RSI_upper === null || getNum(rsi, i) <= T_RSI_upper) &&
        (T_MFI_upper === null || getNum(mfi, i) <= T_MFI_upper)
      );

      // Rule Alpha — RSI OR MFI breaches its adaptive upper threshold
      const ruleAlpha =
        (T_RSI_upper !== null &&
          isNum(rsi, i) &&
          getNum(rsi, i) > T_RSI_upper) ||
        (T_MFI_upper !== null && isNum(mfi, i) && getNum(mfi, i) > T_MFI_upper);

      if (ruleAlpha) {
        // Record the peak (overwrite with most recent if multiple peaks occur)
        alphaPeakIdx = i;
        alphaPeakPrice = bar.close;
        alphaPeakRSI = isNum(rsi, i) ? getNum(rsi, i) : null;
        alphaPeakMACD = isNum(macd, i) ? getNum(macd, i) : null;
      }

      let exitReason = "";

      // Final Execution only evaluates AFTER a peak has been established
      if (
        alphaPeakIdx !== null &&
        alphaPeakPrice !== null &&
        alphaPeakRSI !== null &&
        alphaPeakMACD !== null &&
        i > alphaPeakIdx
      ) {
        // Rule Beta — ROC21(t) < ROC21(t-1): current day deceleration
        const ruleBeta =
          i >= 1 &&
          isNum(roc21, i) &&
          isNum(roc21, i - 1) &&
          getNum(roc21, i) < getNum(roc21, i - 1);

        // Rule Gamma — price >= peak AND RSI < peak RSI AND MACD < peak MACD
        const ruleGamma =
          isNum(rsi, i) &&
          isNum(macd, i) &&
          bar.close >= alphaPeakPrice &&
          getNum(rsi, i) < alphaPeakRSI &&
          getNum(macd, i) < alphaPeakMACD;

        // Final Execution — all three align
        if (ruleBeta && ruleGamma) {
          exitReason = "Divergence-Decay Exit";
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

        // Clear alpha peak state after exit
        alphaPeakIdx = null;
        alphaPeakPrice = null;
        alphaPeakRSI = null;
        alphaPeakMACD = null;
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
