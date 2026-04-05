import { ChevronDown, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertPanel } from "./components/AlertPanel";
import { Header } from "./components/Header";
import { PlaybackBar } from "./components/PlaybackBar";
import { TradesSummary } from "./components/TradesSummary";
import { AlertsTab } from "./components/tabs/AlertsTab";
import { ChartTab } from "./components/tabs/ChartTab";
import { ExitModulesTab } from "./components/tabs/ExitModulesTab";
import { LogsTab } from "./components/tabs/LogsTab";
import { OverviewTab } from "./components/tabs/OverviewTab";
import { useActor } from "./hooks/useActor";
import type {
  AlertEntry,
  DayData,
  LogEntry,
  TradeRecord,
} from "./lib/playback";
import { generateSampleDayData } from "./lib/sampleDayData";

const SAMPLE_DATA = generateSampleDayData();

type ActiveTab =
  | "overview"
  | "chart"
  | "modules"
  | "logs"
  | "alerts"
  | "trades";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function yearAgoStr() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

export default function App() {
  const { actor } = useActor();
  const [data, setData] = useState<DayData[]>(SAMPLE_DATA);
  const [currentDay, setCurrentDay] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2 | 5>(1);
  const [inPosition, setInPosition] = useState(true);
  const [openTrade, setOpenTrade] = useState<TradeRecord | null>(
    SAMPLE_DATA.length > 0
      ? { entryDay: 0, entryPrice: SAMPLE_DATA[0].price }
      : null,
  );
  const [completedTrades, setCompletedTrades] = useState<TradeRecord[]>([]);
  const [executionLog, setExecutionLog] = useState<LogEntry[]>(
    SAMPLE_DATA.length > 0
      ? [
          {
            day: 0,
            type: "entry",
            message: `ENTRY @ $${SAMPLE_DATA[0].price.toFixed(2)} | Auto-entry: first price in dataset`,
            module: "entry",
          },
        ]
      : [],
  );
  const [alertLog, setAlertLog] = useState<AlertEntry[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [alertPanelOpen, setAlertPanelOpen] = useState(true);
  const [dataInputOpen, setDataInputOpen] = useState(false);
  const [rawInput, setRawInput] = useState("");
  const [sessionStart] = useState(() => new Date());
  const [elapsed, setElapsed] = useState(0);
  const [exitBanner, setExitBanner] = useState<string | null>(null);
  const [coolingOffUntilDay, setCoolingOffUntilDay] = useState<number | null>(
    null,
  );
  const [alphaPeak, setAlphaPeak] = useState<{
    idx: number;
    price: number;
    rsi: number;
    macd: number;
  } | null>(null);

  // Auto-fetch state
  const [stockSymbol, setStockSymbol] = useState("");
  const [fromDate, setFromDate] = useState(yearAgoStr);
  const [toDate, setToDate] = useState(todayStr);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [pasteError, setPasteError] = useState<string | null>(null);

  // Refs to avoid stale closures
  const inPositionRef = useRef(true);
  const openTradeRef = useRef<TradeRecord | null>(
    SAMPLE_DATA.length > 0
      ? { entryDay: 0, entryPrice: SAMPLE_DATA[0].price }
      : null,
  );
  const dataRef = useRef<DayData[]>(SAMPLE_DATA);
  const coolingOffUntilDayRef = useRef<number | null>(null);
  const lastExitPriceRef = useRef<number | null>(null);
  const alphaPeakRef = useRef<{
    idx: number;
    price: number;
    rsi: number;
    macd: number;
  } | null>(null);

  // Keep refs in sync
  useEffect(() => {
    inPositionRef.current = inPosition;
  }, [inPosition]);
  useEffect(() => {
    openTradeRef.current = openTrade;
  }, [openTrade]);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  useEffect(() => {
    coolingOffUntilDayRef.current = coolingOffUntilDay;
  }, [coolingOffUntilDay]);

  // Session timer
  useEffect(() => {
    const t = setInterval(
      () =>
        setElapsed(Math.floor((Date.now() - sessionStart.getTime()) / 1000)),
      1000,
    );
    return () => clearInterval(t);
  }, [sessionStart]);

  // Exit banner auto-dismiss
  useEffect(() => {
    if (exitBanner) {
      const t = setTimeout(() => setExitBanner(null), 5000);
      return () => clearTimeout(t);
    }
  }, [exitBanner]);

  // Playback interval
  useEffect(() => {
    if (!isPlaying) return;
    const intervalMs = speed === 5 ? 160 : speed === 2 ? 400 : 800;
    const interval = setInterval(() => {
      setCurrentDay((prev) => {
        const next = prev + 1;
        if (next >= dataRef.current.length) {
          setIsPlaying(false);
          return prev;
        }
        return next;
      });
    }, intervalMs);
    return () => clearInterval(interval);
  }, [isPlaying, speed]);

  const addLog = useCallback((entry: LogEntry) => {
    setExecutionLog((prev) => [...prev, entry]);
  }, []);

  const addAlert = useCallback((entry: AlertEntry) => {
    setAlertLog((prev) => [...prev, entry]);
  }, []);

  const evaluateDay = useCallback(
    (dayIdx: number) => {
      const arr = dataRef.current;
      const d = arr[dayIdx];
      const prev = dayIdx >= 1 ? arr[dayIdx - 1] : null;

      if (inPositionRef.current) {
        // --- Divergence-Decay Exit Protocol ---

        // Dynamic thresholds: rolling 85th percentile over last 50 bars
        // Returns null only when zero valid data points exist (slice.length === 0)
        const rollingPctFromArr = (
          field: keyof typeof d,
          upToIdx: number,
          window: number,
          pct: number,
        ): number | null => {
          const slice: number[] = [];
          for (let j = Math.max(0, upToIdx - window + 1); j <= upToIdx; j++) {
            const v = arr[j]?.[field] as number;
            if (v !== undefined && !Number.isNaN(v)) slice.push(v);
          }
          if (slice.length === 0) return null;
          slice.sort((a, b) => a - b);
          return slice[Math.floor(pct * (slice.length - 1))];
        };

        const T_RSI_upper = rollingPctFromArr("rsi", dayIdx, 50, 0.85);
        const T_MFI_upper = rollingPctFromArr("mfi", dayIdx, 50, 0.85);

        // Rule Zero: AVOID — both RSI and MFI are at or below their adaptive upper thresholds
        // I_avoid(t) = RSI(t) <= T_RSI_upper(t) AND MFI(t) <= T_MFI_upper(t)
        const ruleZeroAvoid =
          (T_RSI_upper === null || d.rsi <= T_RSI_upper) &&
          (T_MFI_upper === null || d.mfi <= T_MFI_upper);

        const prevHadPeak = alphaPeakRef.current !== null;

        if (ruleZeroAvoid && !prevHadPeak) {
          // AVOID state is active — log it
          addLog({
            day: dayIdx,
            type: "info",
            message: `AVOID — RSI ${d.rsi.toFixed(1)} ≤ ${T_RSI_upper?.toFixed(1) ?? "n/a"} | MFI ${d.mfi.toFixed(1)} ≤ ${T_MFI_upper?.toFixed(1) ?? "n/a"} | Both below adaptive threshold`,
            module: "avoid",
          });
        }

        // Rule Alpha — RSI OR MFI breaches its adaptive upper threshold (cancels AVOID)
        // No fixed fallback: threshold is only unavailable when zero data exists
        const ruleAlpha =
          (T_RSI_upper !== null && d.rsi > T_RSI_upper) ||
          (T_MFI_upper !== null && d.mfi > T_MFI_upper);

        if (ruleAlpha) {
          alphaPeakRef.current = {
            idx: dayIdx,
            price: d.price,
            rsi: d.rsi,
            macd: d.macd,
          };
          setAlphaPeak(alphaPeakRef.current);
          addAlert({
            day: dayIdx,
            message: `AVOID CLEARED — Momentum peak identified: RSI ${d.rsi.toFixed(1)} vs threshold ${T_RSI_upper?.toFixed(1) ?? "n/a"} | MFI ${d.mfi.toFixed(1)} vs threshold ${T_MFI_upper?.toFixed(1) ?? "n/a"} | System enters TRACKING state`,
            level: "warning",
          });
          addLog({
            day: dayIdx,
            type: "info",
            message: `TRACKING — Rule Alpha fired, AVOID cleared. Peak @ $${d.price.toFixed(2)} | RSI ${d.rsi.toFixed(1)} | MFI ${d.mfi.toFixed(1)}`,
            module: "alpha",
          });
        }

        let exitReason = "";

        if (
          alphaPeakRef.current !== null &&
          dayIdx > alphaPeakRef.current.idx
        ) {
          const peak = alphaPeakRef.current;

          // Rule Beta — ROC21 day-over-day deceleration
          const ruleBeta = prev !== null && d.roc21 < prev.roc21;

          // Rule Gamma — price/RSI/MACD divergence vs peak
          const ruleGamma =
            d.price >= peak.price && d.rsi < peak.rsi && d.macd < peak.macd;

          // Final Execution — all three conditions simultaneously
          if (ruleBeta && ruleGamma) {
            exitReason = "Divergence-Decay Exit";
          }
        }

        if (exitReason && openTradeRef.current) {
          const entryPrice = openTradeRef.current.entryPrice;
          const pnlPct = ((d.price - entryPrice) / entryPrice) * 100;
          const completed: TradeRecord = {
            ...openTradeRef.current,
            exitDay: dayIdx,
            exitPrice: d.price,
            exitReason,
            pnlPct,
          };
          setCompletedTrades((prev) => [...prev, completed]);
          setOpenTrade(null);
          setInPosition(false);
          setExitBanner(exitReason);
          addLog({
            day: dayIdx,
            type: "exit",
            message: `EXIT [${exitReason}] @ $${d.price.toFixed(2)} | P&L ${pnlPct.toFixed(2)}%`,
            module: exitReason,
          });
          addAlert({
            day: dayIdx,
            message:
              "DIVERGENCE-DECAY EXIT triggered — Beta+Gamma alignment confirmed",
            level: "critical",
          });
          // Store exit price for use as re-entry price
          lastExitPriceRef.current = d.price;
          // Start cooling-off period: wait 3 days before scanning for re-entry
          const coolUntil = dayIdx + 3;
          setCoolingOffUntilDay(coolUntil);
          coolingOffUntilDayRef.current = coolUntil;
          // Clear alpha peak state after exit
          alphaPeakRef.current = null;
          setAlphaPeak(null);
        }
      } else {
        // Not in position — handle re-entry logic
        if (coolingOffUntilDayRef.current !== null) {
          if (dayIdx < coolingOffUntilDayRef.current) {
            const daysLeft = coolingOffUntilDayRef.current - dayIdx;
            addLog({
              day: dayIdx,
              type: "info",
              message: `COOLING OFF — ${daysLeft} day(s) until re-entry scan begins`,
              module: "reentry",
            });
          } else {
            const roc21Met = d.roc21 > 0;
            const rsiMet = d.rsi > 50;
            const mfiMet = d.mfi > 45;

            if (roc21Met && rsiMet && mfiMet) {
              const reEntryPrice = d.price;
              const newTrade: TradeRecord = {
                entryDay: dayIdx,
                entryPrice: reEntryPrice,
              };
              setInPosition(true);
              inPositionRef.current = true;
              setOpenTrade(newTrade);
              openTradeRef.current = newTrade;
              addLog({
                day: dayIdx,
                type: "entry",
                message: `ENTRY @ $${reEntryPrice.toFixed(2)} | Re-entry: ROC21/RSI/MFI conditions met`,
                module: "entry",
              });
              const macdPositive = d.macd > 0;
              const macdImproving = prev !== null && d.macd > prev.macd;
              if (macdPositive || macdImproving) {
                const detail = macdPositive ? "positive" : "improving";
                addLog({
                  day: dayIdx,
                  type: "info",
                  message: `MACD confirmation: ${detail} — high-confidence re-entry`,
                  module: "reentry",
                });
              }
              setCoolingOffUntilDay(null);
              coolingOffUntilDayRef.current = null;
            } else {
              addLog({
                day: dayIdx,
                type: "info",
                message: `RE-ENTRY SCAN: ROC21 ${d.roc21.toFixed(1)} (need>0) | RSI ${d.rsi.toFixed(1)} (need>50) | MFI ${d.mfi.toFixed(1)} (need>45) — conditions not met`,
                module: "reentry",
              });
            }
          }
        }
      }
    },
    [addLog, addAlert],
  );

  // Evaluate day on change
  useEffect(() => {
    if (dataRef.current.length === 0 || currentDay < 1) return;
    evaluateDay(currentDay);
  }, [currentDay, evaluateDay]);

  function resetAll(newData?: DayData[]) {
    const d = newData ?? data;
    setData(d);
    dataRef.current = d;
    setCurrentDay(0);
    setIsPlaying(false);
    setCompletedTrades([]);
    setAlertLog([]);
    setExitBanner(null);
    setCoolingOffUntilDay(null);
    coolingOffUntilDayRef.current = null;
    lastExitPriceRef.current = null;
    alphaPeakRef.current = null;
    setAlphaPeak(null);

    if (d.length > 0) {
      const autoTrade: TradeRecord = { entryDay: 0, entryPrice: d[0].price };
      setInPosition(true);
      inPositionRef.current = true;
      setOpenTrade(autoTrade);
      openTradeRef.current = autoTrade;
      setExecutionLog([
        {
          day: 0,
          type: "entry",
          message: `ENTRY @ $${d[0].price.toFixed(2)} | Auto-entry: first price in dataset`,
          module: "entry",
        },
      ]);
    } else {
      setInPosition(false);
      inPositionRef.current = false;
      setOpenTrade(null);
      openTradeRef.current = null;
      setExecutionLog([]);
    }
  }

  async function handleAutoFetch() {
    const sym = stockSymbol.trim().toUpperCase();
    if (!sym) {
      setFetchError(
        "Please enter a stock symbol (e.g. RELIANCE, TCS, INFY, NATIONALUM)",
      );
      return;
    }
    if (!fromDate || !toDate) {
      setFetchError("Please select both From and To dates");
      return;
    }
    if (!actor) {
      setFetchError("Backend not ready. Please wait a moment and try again.");
      return;
    }

    setFetchLoading(true);
    setFetchError(null);

    try {
      const startTs = Math.floor(new Date(fromDate).getTime() / 1000);
      const endTs = Math.floor(new Date(toDate).getTime() / 1000);

      // Call backend which fetches from Stooq (avoids CORS/403 issues)
      const result = await actor.fetchStockData(
        sym,
        BigInt(startTs),
        BigInt(endTs),
      );

      let csvText: string;
      if ("err" in result) {
        throw new Error(result.err);
      }
      csvText = result.ok;

      // Parse Stooq CSV: Date,Open,High,Low,Close,Volume
      const csvLines = csvText.trim().split("\n").filter(Boolean);
      if (csvLines.length < 2) {
        throw new Error(
          "No data returned for this symbol. Check the symbol name (e.g. RELIANCE, NATIONALUM, TCS) and date range.",
        );
      }

      // Skip header row
      const rawBars = csvLines
        .slice(1)
        .map((line) => {
          const cols = line.split(",");
          return {
            date: cols[0]?.trim() ?? "",
            open: Number.parseFloat(cols[1] ?? "NaN"),
            high: Number.parseFloat(cols[2] ?? "NaN"),
            low: Number.parseFloat(cols[3] ?? "NaN"),
            close: Number.parseFloat(cols[4] ?? "NaN"),
            volume: Number.parseFloat(cols[5] ?? "0") || 0,
          };
        })
        .filter(
          (b) =>
            b.date.length > 0 &&
            !Number.isNaN(b.close) &&
            b.close > 0 &&
            !Number.isNaN(b.open) &&
            !Number.isNaN(b.high) &&
            !Number.isNaN(b.low),
        )
        .sort((a, b) => a.date.localeCompare(b.date));

      if (rawBars.length < 30) {
        throw new Error(
          `Not enough data (${rawBars.length} bars). Need at least 30 trading days. Try extending the date range or check the symbol.`,
        );
      }

      const { calcAllIndicators } = await import("./lib/indicators");
      const ind = calcAllIndicators(rawBars);
      const parsed: DayData[] = rawBars
        .slice(26)
        .map((b, i) => {
          const idx = i + 26;
          return {
            price: b.close,
            roc21: ind.roc21[idx] ?? 0,
            rsi: ind.rsi[idx] ?? 50,
            macd: ind.macd[idx] ?? 0,
            mfi: ind.mfi[idx] ?? 50,
            momentum: ind.momentum[idx] ?? 0,
            date: b.date,
          };
        })
        .filter((d) => d.price > 0);

      if (parsed.length === 0) {
        throw new Error(
          "Could not compute indicators. Try a longer date range.",
        );
      }

      resetAll(parsed);
      setDataInputOpen(false);
    } catch (err: any) {
      setFetchError(
        err?.message ?? "Failed to fetch stock data. Please try again.",
      );
    } finally {
      setFetchLoading(false);
    }
  }

  async function handleLoadData() {
    setPasteError(null);

    // Normalize line endings and collect non-empty lines
    const lines = rawInput
      .trim()
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .filter((l) => l.trim().length > 0);

    if (lines.length === 0) {
      setPasteError("No data found. Please paste your data above.");
      return;
    }

    // Helper: split a line by tab, comma, or multiple spaces
    function splitCols(line: string): string[] {
      if (line.includes("\t")) return line.split(/\t+/).map((c) => c.trim());
      if (line.includes(",")) return line.split(/,+/).map((c) => c.trim());
      return line
        .trim()
        .split(/\s+/)
        .map((c) => c.trim());
    }

    const firstLine = lines[0];
    const firstCols = splitCols(firstLine);
    const firstField = (firstCols[0] ?? "").trim().toLowerCase();

    // Step 1: Is the first token a valid positive number? → Format A, no header to skip
    const firstNum = Number.parseFloat(firstField);
    const isNumericFirst = !Number.isNaN(firstNum) && firstNum > 0;

    // Step 2: Is the first token a known pre-computed indicator header keyword?
    const PRECOMPUTED_HEADERS = [
      "price",
      "roc",
      "rsi",
      "macd",
      "mfi",
      "momentum",
    ];
    const isPrecomputedHeader = PRECOMPUTED_HEADERS.some(
      (kw) => firstField === kw || firstField.startsWith(kw),
    );

    // Step 3: Is the first token a date pattern or OHLCV header keyword?
    const OHLCV_HEADERS = ["date", "open", "high", "low", "close", "volume"];
    const looksLikeDate =
      /\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(firstField) ||
      /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(firstField);
    const isOHLCVKeyword = OHLCV_HEADERS.includes(firstField);
    const isOHLCV = looksLikeDate || isOHLCVKeyword;

    if (!isNumericFirst && isOHLCV) {
      // Format B — OHLCV (Date, Open, High, Low, Close, Volume)
      try {
        const dataLines = isOHLCVKeyword ? lines.slice(1) : lines;
        const bars = dataLines
          .map((line) => {
            const cols = splitCols(line);
            if (cols.length < 5) return null;
            return {
              date: cols[0]?.trim() ?? "",
              open: Number.parseFloat(cols[1] ?? "NaN"),
              high: Number.parseFloat(cols[2] ?? "NaN"),
              low: Number.parseFloat(cols[3] ?? "NaN"),
              close: Number.parseFloat(cols[4] ?? "NaN"),
              volume: Number.parseFloat(cols[5] ?? "0") || 0,
            };
          })
          .filter(
            (b): b is NonNullable<typeof b> =>
              b !== null &&
              !Number.isNaN(b.close) &&
              b.close > 0 &&
              !Number.isNaN(b.open) &&
              !Number.isNaN(b.high) &&
              !Number.isNaN(b.low),
          )
          .sort((a, b) => a.date.localeCompare(b.date));

        if (bars.length < 30) {
          setPasteError(
            `Not enough data (${bars.length} bars). Need at least 30 trading days for OHLCV. If you have pre-computed indicators (Price, ROC21, RSI, MACD, MFI, Momentum), paste those directly — any number of rows works.`,
          );
          return;
        }

        const { calcAllIndicators } = await import("./lib/indicators");
        const ind = calcAllIndicators(bars);
        const parsed: DayData[] = bars
          .slice(26)
          .map((b, i) => {
            const idx = i + 26;
            return {
              price: b.close,
              roc21: ind.roc21[idx] ?? 0,
              rsi: ind.rsi[idx] ?? 50,
              macd: ind.macd[idx] ?? 0,
              mfi: ind.mfi[idx] ?? 50,
              momentum: ind.momentum[idx] ?? 0,
              date: b.date,
            };
          })
          .filter((d) => d.price > 0);

        if (parsed.length === 0) {
          setPasteError(
            "Could not compute indicators. Try pasting more data (at least 30 rows).",
          );
          return;
        }

        resetAll(parsed);
        setDataInputOpen(false);
      } catch {
        setPasteError("Could not parse OHLCV data. Check format.");
      }
    } else {
      // Format A — pre-computed indicators: PRICE ROC21 RSI MACD MFI Momentum
      // Skip the first line if it is a known header keyword (not a number)
      const dataLines =
        !isNumericFirst && isPrecomputedHeader ? lines.slice(1) : lines;

      const parsed: DayData[] = dataLines
        .map((line) => {
          const cols = splitCols(line);
          if (cols.length < 6) return null;
          const price = Number.parseFloat(cols[0]);
          const roc21 = Number.parseFloat(cols[1]);
          const rsi = Number.parseFloat(cols[2]);
          const macd = Number.parseFloat(cols[3]);
          const mfi = Number.parseFloat(cols[4]);
          const momentum = Number.parseFloat(cols[5]);
          if (Number.isNaN(price) || price <= 0) return null;
          return { price, roc21, rsi, macd, mfi, momentum } as DayData;
        })
        .filter((d): d is DayData => d !== null);

      if (parsed.length > 0) {
        resetAll(parsed);
        setDataInputOpen(false);
      } else {
        setPasteError(
          "Could not parse data. Expected 6 columns: Price, ROC21, RSI, MACD, MFI, Momentum — tab or space separated. Header row (PRICE DAY ROC21 ...) is optional.",
        );
      }
    }
  }
  function handleClear() {
    setRawInput("");
    resetAll(SAMPLE_DATA);
  }

  function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.trim().split("\n");
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const dateIdx = headers.indexOf("date");
      const openIdx = headers.indexOf("open");
      const highIdx = headers.indexOf("high");
      const lowIdx = headers.indexOf("low");
      const closeIdx = headers.indexOf("close");
      const volIdx = headers.indexOf("volume");

      if (closeIdx === -1) return;

      const { generateTradingData } = { generateTradingData: null } as any;
      void generateTradingData;

      import("./lib/indicators").then(({ calcAllIndicators }) => {
        import("./lib/sampleData").then(() => {
          const bars = lines
            .slice(1)
            .map((line) => {
              const cols = line.split(",");
              if (cols.length < 5) return null;
              return {
                date: cols[dateIdx]?.trim() ?? "",
                open: Number.parseFloat(cols[openIdx] ?? cols[1]),
                high: Number.parseFloat(cols[highIdx] ?? cols[2]),
                low: Number.parseFloat(cols[lowIdx] ?? cols[3]),
                close: Number.parseFloat(cols[closeIdx]),
                volume: Number.parseInt(cols[volIdx] ?? "1000000"),
              };
            })
            .filter(
              (b): b is NonNullable<typeof b> =>
                b !== null && !Number.isNaN(b.close),
            );

          if (bars.length < 30) return;
          const ind = calcAllIndicators(bars);
          const parsed: DayData[] = bars
            .slice(26)
            .map((b, i) => {
              const idx = i + 26;
              return {
                price: b.close,
                roc21: ind.roc21[idx] ?? 0,
                rsi: ind.rsi[idx] ?? 50,
                macd: ind.macd[idx] ?? 0,
                mfi: ind.mfi[idx] ?? 50,
                momentum: ind.momentum[idx] ?? 0,
                date: b.date,
              };
            })
            .filter((d) => d.roc21 !== 0 && d.rsi !== 50);

          if (parsed.length > 0) {
            resetAll(parsed);
            setDataInputOpen(false);
          }
        });
      });
    };
    reader.readAsText(file);
  }

  // Derived state
  const currentData = data[currentDay] ?? null;
  const prevData = currentDay >= 1 ? data[currentDay - 1] : null;

  const pnl =
    openTrade && currentData
      ? ((currentData.price - openTrade.entryPrice) / openTrade.entryPrice) *
        100
      : completedTrades.length > 0
        ? (completedTrades[completedTrades.length - 1].pnlPct ?? 0)
        : 0;

  const daysHeld = openTrade ? currentDay - openTrade.entryDay : 0;

  const cbStatus: "OK" | "ARMED" | "TRIGGERED" = !currentData
    ? "OK"
    : currentData.roc21 <= -9
      ? "TRIGGERED"
      : currentData.roc21 <= -3
        ? "ARMED"
        : "OK";

  const alertDays = alertLog.map((a) => a.day);

  const TABS: { id: ActiveTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "chart", label: "Chart" },
    { id: "modules", label: "Exit Modules" },
    { id: "logs", label: "Execution Log" },
    { id: "alerts", label: "Alerts" },
    { id: "trades", label: "Trades" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Header
        sessionStart={sessionStart}
        elapsed={elapsed}
        currentData={currentData}
        openTrade={openTrade}
        pnl={pnl}
        daysHeld={daysHeld}
        speed={speed}
        onSpeedChange={setSpeed}
      />

      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 py-4 pb-20 space-y-4">
        {/* Data Input Panel */}
        <div
          className="bg-card border border-border rounded-lg"
          data-ocid="data_input.panel"
        >
          <button
            type="button"
            data-ocid="data_input.toggle"
            onClick={() => setDataInputOpen(!dataInputOpen)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-secondary/20 transition-colors"
          >
            <span>📊 Data Input</span>
            <ChevronDown
              size={16}
              className={`transition-transform text-muted-foreground ${dataInputOpen ? "rotate-180" : ""}`}
            />
          </button>
          {dataInputOpen && (
            <div className="px-4 pb-4 space-y-4 border-t border-border pt-3">
              {/* ── Auto-Fetch Section ── */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                    🔍 Auto-Fetch NSE Stock Data
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  India NSE stocks — enter symbol only (e.g.{" "}
                  <span className="text-foreground font-medium">RELIANCE</span>,
                  not RELIANCE.NS)
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1">
                    <label
                      className="text-xs text-muted-foreground font-medium"
                      htmlFor="stock-symbol"
                    >
                      Stock Symbol
                    </label>
                    <input
                      id="stock-symbol"
                      data-ocid="data_input.search_input"
                      type="text"
                      value={stockSymbol}
                      onChange={(e) => setStockSymbol(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAutoFetch();
                      }}
                      placeholder="e.g. RELIANCE, TCS, INFY, HDFC"
                      className="bg-input border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 uppercase"
                      style={{ textTransform: "uppercase" }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label
                      className="text-xs text-muted-foreground font-medium"
                      htmlFor="from-date"
                    >
                      From Date
                    </label>
                    <input
                      id="from-date"
                      data-ocid="data_input.input"
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="bg-input border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label
                      className="text-xs text-muted-foreground font-medium"
                      htmlFor="to-date"
                    >
                      To Date
                    </label>
                    <input
                      id="to-date"
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="bg-input border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  data-ocid="data_input.primary_button"
                  onClick={handleAutoFetch}
                  disabled={fetchLoading}
                  className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2 rounded text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {fetchLoading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Fetching...</span>
                    </>
                  ) : (
                    <>
                      <span>⚡</span>
                      <span>Fetch &amp; Run</span>
                    </>
                  )}
                </button>

                {fetchError && (
                  <div
                    data-ocid="data_input.error_state"
                    className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-2"
                  >
                    ⚠ {fetchError}
                  </div>
                )}
              </div>

              {/* ── Divider ── */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  — or paste / upload manually —
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* ── Manual Paste / Upload Section ── */}
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground whitespace-pre-line">
                  {
                    "Paste pre-computed indicator data (Price ROC21 RSI MACD MFI Momentum), tab or space separated. Header row is optional and will be auto-skipped."
                  }
                </p>
                <textarea
                  data-ocid="data_input.textarea"
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                  rows={6}
                  className="w-full bg-input border border-border rounded px-3 py-2 text-xs font-mono text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder={
                    "Pre-computed (tab or space separated, any number of rows):\n169.875   5.5   59.02   4.89   64.18   71.69\n167.6     -0.4  55.99   4.6    63.97   71.69\n\nWith optional header (will be auto-skipped):\nPRICE   DAY ROC21   DAY RSI   DAY MACD   DAY MFI   MOMENTUM SCORE\n169.875   5.5   59.02   4.89   64.18   71.69"
                  }
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    data-ocid="data_input.load.primary_button"
                    onClick={handleLoadData}
                    className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    Load & Run
                  </button>
                  <button
                    type="button"
                    data-ocid="data_input.clear.button"
                    onClick={handleClear}
                    className="bg-secondary text-secondary-foreground px-4 py-2 rounded text-sm hover:bg-secondary/80 transition-colors"
                  >
                    Clear
                  </button>
                  <label className="bg-secondary text-secondary-foreground px-4 py-2 rounded text-sm cursor-pointer hover:bg-secondary/80 transition-colors">
                    Upload CSV
                    <input
                      type="file"
                      accept=".csv"
                      data-ocid="data_input.upload_button"
                      onChange={handleCSV}
                      className="hidden"
                    />
                  </label>
                </div>
                {pasteError && (
                  <div
                    data-ocid="data_input.paste.error_state"
                    className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-2"
                  >
                    ⚠ {pasteError}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Exit banner */}
        {exitBanner && (
          <div
            style={{
              background:
                "linear-gradient(90deg, oklch(0.65 0.26 25 / 0.18) 0%, oklch(0.65 0.26 25 / 0.08) 100%)",
              border: "1px solid oklch(0.65 0.26 25 / 0.5)",
              color: "oklch(0.65 0.26 25)",
              borderRadius: "0.5rem",
              boxShadow: "0 0 20px oklch(0.65 0.26 25 / 0.15)",
            }}
            className="flex items-center justify-between px-4 py-2.5 text-sm font-medium"
          >
            <span>⚡ EXIT TRIGGERED: {exitBanner}</span>
            <button
              type="button"
              onClick={() => setExitBanner(null)}
              className="ml-4 hover:opacity-70"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Tab navigation */}
        <div className="flex gap-1 border-b border-border">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              data-ocid={`tab.${tab.id}.tab`}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {tab.id === "alerts" && alertLog.length > 0 && (
                <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-warning/20 text-warning">
                  {alertLog.length}
                </span>
              )}
              {tab.id === "trades" && completedTrades.length > 0 && (
                <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">
                  {completedTrades.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div>
          {activeTab === "overview" && (
            <OverviewTab
              data={data}
              currentDay={currentDay}
              openTrade={openTrade}
            />
          )}
          {activeTab === "chart" && (
            <ChartTab
              data={data}
              currentDay={currentDay}
              openTrade={openTrade}
              completedTrades={completedTrades}
              alertDays={alertDays}
            />
          )}
          {activeTab === "modules" && (
            <ExitModulesTab
              currentData={currentData}
              prevData={prevData}
              inPosition={inPosition}
              coolingOffUntilDay={coolingOffUntilDay}
              currentDay={currentDay}
              allData={data}
              alphaPeak={alphaPeak}
            />
          )}
          {activeTab === "logs" && (
            <LogsTab logs={executionLog} currentDay={currentDay} />
          )}
          {activeTab === "alerts" && <AlertsTab alerts={alertLog} />}
          {activeTab === "trades" && (
            <TradesSummary
              completedTrades={completedTrades}
              openTrade={openTrade}
              currentPrice={currentData?.price ?? null}
            />
          )}
        </div>
      </main>

      <footer className="border-t border-border py-3 mb-14 px-4 flex justify-between text-xs text-muted-foreground">
        <span>QuantViz v2.0 — Quantitative Strategy Simulator</span>
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-primary transition-colors"
        >
          Built with ♥ using caffeine.ai
        </a>
      </footer>

      <AlertPanel
        alerts={alertLog}
        isOpen={alertPanelOpen}
        onToggle={() => setAlertPanelOpen(!alertPanelOpen)}
      />

      <PlaybackBar
        isPlaying={isPlaying}
        onPlayPause={() => setIsPlaying(!isPlaying)}
        onReset={() => resetAll()}
        speed={speed}
        onSpeedChange={setSpeed}
        currentDay={currentDay}
        totalDays={data.length}
        cbStatus={cbStatus}
        pnl={pnl}
      />
    </div>
  );
}
