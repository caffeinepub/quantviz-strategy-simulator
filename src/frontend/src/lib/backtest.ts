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

export interface BacktestAlert {
  date: string;
  message: string;
  level: "info" | "warning" | "critical";
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
  alerts: BacktestAlert[];
}

function getNum(arr: (number | null)[], i: number): number {
  return (arr[i] as number) ?? 0;
}

function isNum(arr: (number | null)[], i: number): boolean {
  return arr[i] !== null && !Number.isNaN(arr[i]);
}

/**
 * Compute rolling percentile over PRIOR bars only (bars 0..i-1).
 * Uses a lookback window of `windowSize` days.
 * Returns null only when there are zero prior data points.
 */
function rollingPercentile(
  arr: (number | null)[],
  i: number,
  windowSize: number,
  pct: number,
): number | null {
  if (i === 0) return null; // no prior data
  const slice: number[] = [];
  for (let j = Math.max(0, i - windowSize); j < i; j++) {
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
  const alerts: BacktestAlert[] = [];

  // ── State Machine Memory (Step 1: Initialize) ──────────────────────────────
  // Thresholds use a 20-day rolling window (localized std/mean per user spec)
  const THRESHOLD_WINDOW = 20;
  const THRESHOLD_PCT = 0.85;

  type SystemState = "AVOID" | "TRACKING";
  let system_state: SystemState = "AVOID";
  let peak_price = 0.0;
  let peak_rsi = 0.0;
  let peak_macd = 0.0;
  let prev_roc21 = 0.0;
  // Alert dedup flags (reset per trade cycle)
  let betaAlerted = false;
  let gammaAlerted = false;
  let avoidAlerted = false;
  // ────────────────────────────────────────────────────────────────────────────

  for (let fi = 0; fi < filteredBars.length; fi++) {
    const i = fi + offset;
    const bar = filteredBars[fi];

    // ── Step A: Calculate current indicators & rolling thresholds ────────────
    const T_RSI_upper = rollingPercentile(
      rsi,
      i,
      THRESHOLD_WINDOW,
      THRESHOLD_PCT,
    );
    const T_MFI_upper = rollingPercentile(
      mfi,
      i,
      THRESHOLD_WINDOW,
      THRESHOLD_PCT,
    );

    const cur_rsi = isNum(rsi, i) ? getNum(rsi, i) : 0;
    const cur_mfi = isNum(mfi, i) ? getNum(mfi, i) : 0;
    const cur_roc21 = isNum(roc21, i) ? getNum(roc21, i) : 0;
    const cur_macd = isNum(macd, i) ? getNum(macd, i) : 0;
    const cur_price = bar.close;
    // ────────────────────────────────────────────────────────────────────────

    if (!inPosition) {
      // Handle entry logic
      if (lastExitIdx === null) {
        // First bar: only auto-enter if Rule Alpha is satisfied (system not in AVOID)
        // On day 0 there are no prior bars, so thresholds are null — treat as AVOID blocked
        // (entry happens when system_state transitions to TRACKING)
        // We still run the state machine below so that on day 0 if alpha fires, we enter
      } else {
        // Re-entry after exit: cooling-off + 3-condition check
        const coolOffComplete = i >= lastExitIdx + 3;
        if (
          coolOffComplete &&
          isNum(roc21, i) &&
          isNum(rsi, i) &&
          isNum(mfi, i) &&
          cur_roc21 > 0 &&
          cur_rsi > 50 &&
          cur_mfi > 45
        ) {
          inPosition = true;
          entryPrice = bar.close;
          entryDate = bar.date;
          entryIdx = i;
          // Reset state machine for new trade
          system_state = "AVOID";
          peak_price = 0.0;
          peak_rsi = 0.0;
          peak_macd = 0.0;
          prev_roc21 = 0.0;
        }
      }

      // If still not in position after re-entry check, run state machine
      // to see if this is the first entry (day 0 is handled below in state machine)
      if (!inPosition) {
        // ── Step B: Rule Zero (AVOID block) ──────────────────────────────────
        if (system_state === "AVOID") {
          const rsiAbove = T_RSI_upper !== null && cur_rsi > T_RSI_upper;
          const mfiAbove = T_MFI_upper !== null && cur_mfi > T_MFI_upper;

          if (!rsiAbove && !mfiAbove) {
            // Stay AVOID — no action
          } else {
            // Transition: broken out → go to Step C
            // ── Step C: Rule Alpha — initial peak lock ────────────────────────
            peak_price = cur_price;
            peak_rsi = cur_rsi;
            peak_macd = cur_macd;
            system_state = "TRACKING";

            // Auto-enter on first transition out of AVOID (first bar)
            if (lastExitIdx === null) {
              inPosition = true;
              entryPrice = bar.close;
              entryDate = bar.date;
              entryIdx = i;
            }
          }
        } else if (system_state === "TRACKING") {
          // ── Step C: Rule Alpha — update peak if momentum pushing higher ───
          const rsiAbove = T_RSI_upper !== null && cur_rsi > T_RSI_upper;
          const mfiAbove = T_MFI_upper !== null && cur_mfi > T_MFI_upper;
          if (rsiAbove || mfiAbove) {
            // Momentum still in upper zone — update peak to track the highest point
            if (cur_rsi > peak_rsi || cur_mfi > (T_MFI_upper ?? 0)) {
              peak_price = cur_price;
              peak_rsi = cur_rsi;
              peak_macd = cur_macd;
            }
          }
        }

        // ── Step F: Update prev_roc21 for next day ─────────────────────────
        prev_roc21 = cur_roc21;

        equityCurve.push({
          date: bar.date,
          equity: Number.parseFloat(equity.toFixed(2)),
        });
        continue;
      }
    }

    // ── In position: run state machine ──────────────────────────────────────

    // ── Step B: Rule Zero ──────────────────────────────────────────────────
    if (system_state === "AVOID") {
      const rsiAbove = T_RSI_upper !== null && cur_rsi > T_RSI_upper;
      const mfiAbove = T_MFI_upper !== null && cur_mfi > T_MFI_upper;

      if (!rsiAbove && !mfiAbove) {
        // Stay AVOID — no exit possible
        // Fire AVOID alert once per cycle while in position
        if (!avoidAlerted) {
          avoidAlerted = true;
          alerts.push({
            date: bar.date,
            message: `AVOID — Algorithm in capital preservation mode. No momentum peak detected yet. RSI ${cur_rsi.toFixed(1)} | MFI ${cur_mfi.toFixed(1)} (both below adaptive thresholds).`,
            level: "warning",
          });
        }
        // ── Step F: Update memory ────────────────────────────────────────────
        prev_roc21 = cur_roc21;
        equityCurve.push({
          date: bar.date,
          equity: Number.parseFloat(equity.toFixed(2)),
        });
        continue;
      }

      // Transition from AVOID → TRACKING via Rule Alpha
      // ── Step C: Lock initial peak ────────────────────────────────────────
      peak_price = cur_price;
      peak_rsi = cur_rsi;
      peak_macd = cur_macd;
      system_state = "TRACKING";
      // Reset dedup flags for the new TRACKING cycle
      avoidAlerted = false;
      betaAlerted = false;
      gammaAlerted = false;
      alerts.push({
        date: bar.date,
        message: `RULE ALPHA — Momentum peak detected. Peak logged: Price=${cur_price.toFixed(2)}, RSI=${cur_rsi.toFixed(1)}, MACD=${cur_macd.toFixed(2)}. System now TRACKING for divergence.`,
        level: "warning",
      });

      // ── Step F: Update memory ──────────────────────────────────────────────
      prev_roc21 = cur_roc21;
      equityCurve.push({
        date: bar.date,
        equity: Number.parseFloat(equity.toFixed(2)),
      });
      continue;
    }

    // ── system_state === "TRACKING" ────────────────────────────────────────

    // ── Step C: Rule Alpha — update peak if momentum pushing higher ─────────
    {
      const rsiAbove = T_RSI_upper !== null && cur_rsi > T_RSI_upper;
      const mfiAbove = T_MFI_upper !== null && cur_mfi > T_MFI_upper;
      if (rsiAbove || mfiAbove) {
        if (cur_rsi > peak_rsi || cur_mfi > (T_MFI_upper ?? 0)) {
          peak_price = cur_price;
          peak_rsi = cur_rsi;
          peak_macd = cur_macd;
        }
      }
    }

    // ── Step D: Rule Beta (deceleration filter) ─────────────────────────────
    const ruleBeta = cur_roc21 < prev_roc21;

    // ── Step E: Rule Gamma (divergence-decay execution) ─────────────────────
    const ruleGamma =
      cur_price >= peak_price && cur_rsi < peak_rsi && cur_macd < peak_macd;

    let exitReason = "";

    if (ruleBeta && ruleGamma) {
      exitReason = "Divergence-Decay Exit";
    } else if (ruleBeta && !ruleGamma) {
      // Beta triggered but Gamma not yet — pre-exit warning (fire once per cycle)
      if (!betaAlerted) {
        betaAlerted = true;
        alerts.push({
          date: bar.date,
          message: `RULE BETA — Momentum deceleration confirmed. ROC21 declining (${cur_roc21.toFixed(2)} < ${prev_roc21.toFixed(2)}). Watching for divergence...`,
          level: "warning",
        });
      }
    } else if (!ruleBeta && ruleGamma) {
      // Gamma triggered but Beta not yet — pre-exit warning (fire once per cycle)
      if (!gammaAlerted) {
        gammaAlerted = true;
        alerts.push({
          date: bar.date,
          message: `RULE GAMMA — Price/RSI/MACD divergence detected. Price holding at peak (${cur_price.toFixed(2)} ≥ ${peak_price.toFixed(2)}) while momentum decays (RSI ${cur_rsi.toFixed(1)} < peak ${peak_rsi.toFixed(1)}). Watching for deceleration...`,
          level: "warning",
        });
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

      alerts.push({
        date: bar.date,
        message: `EXIT SIGNAL — All conditions met: Alpha peak @ ${peak_price.toFixed(2)}, Beta (ROC21 decelerating: ${cur_roc21.toFixed(2)} < ${prev_roc21.toFixed(2)}), Gamma (RSI+MACD diverged). Exiting at ${exitPrice.toFixed(2)}.`,
        level: "critical",
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

      // Reset state machine after exit
      system_state = "AVOID";
      peak_price = 0.0;
      peak_rsi = 0.0;
      peak_macd = 0.0;
      betaAlerted = false;
      gammaAlerted = false;
      avoidAlerted = false;
    }

    // ── Step F: Update prev_roc21 for next day ──────────────────────────────
    prev_roc21 = cur_roc21;

    equityCurve.push({
      date: bar.date,
      equity: Number.parseFloat(equity.toFixed(2)),
    });
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
    alerts,
  };
}
