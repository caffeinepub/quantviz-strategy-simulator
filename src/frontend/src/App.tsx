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

  // Auto-fetch state
  const [stockSymbol, setStockSymbol] = useState("");
  const [fromDate, setFromDate] = useState(yearAgoStr);
  const [toDate, setToDate] = useState(todayStr);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

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
      const prev2 = dayIdx >= 2 ? arr[dayIdx - 2] : null;

      if (inPositionRef.current) {
        // HOLD check
        const momDrop3 =
          dayIdx >= 3 ? arr[dayIdx - 3].momentum - d.momentum : 0;
        const hold = d.rsi >= 48 && d.roc21 > -5 && momDrop3 <= 5;

        let exitReason = "";
        if (!hold) {
          if (d.roc21 > 15 && (d.rsi > 75 || d.mfi > 80)) {
            exitReason = "Profit-Take";
          } else if (
            prev &&
            prev2 &&
            d.roc21 < 0 &&
            d.momentum < prev.momentum &&
            prev.momentum < prev2.momentum &&
            prev2.momentum - d.momentum > 8
          ) {
            exitReason = "Momentum Collapse";
          } else if (
            prev &&
            prev2 &&
            d.rsi > 72 &&
            d.rsi < prev.rsi &&
            prev.rsi < prev2.rsi &&
            d.mfi < 50
          ) {
            exitReason = "RSI Divergence";
          } else if (
            prev &&
            d.macd < 0 &&
            d.mfi < 45 &&
            d.momentum < prev.momentum
          ) {
            exitReason = "MACD+MFI Weak";
          } else if (d.roc21 < -3 && (d.rsi < 45 || d.mfi < 45)) {
            exitReason = "Multi-Weak";
          } else if (d.roc21 < -9) {
            exitReason = "Hard Floor";
          }
        } else {
          addLog({
            day: dayIdx,
            type: "hold",
            message: `HOLD — RSI ${d.rsi.toFixed(1)} ≥ 48, ROC21 ${d.roc21.toFixed(1)} > -5, MomDrop ${momDrop3.toFixed(1)} ≤ 5`,
            module: "hold",
          });
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
          // Store exit price for use as re-entry price
          lastExitPriceRef.current = d.price;
          // Start cooling-off period: wait 3 days before scanning for re-entry
          const coolUntil = dayIdx + 3;
          setCoolingOffUntilDay(coolUntil);
          coolingOffUntilDayRef.current = coolUntil;
        }

        // Alert conditions
        if (d.roc21 < -1 && d.roc21 > -3) {
          addAlert({
            day: dayIdx,
            message: `ROC21 ${d.roc21.toFixed(1)}% approaching Multi-Weak threshold (-3)`,
            level: "warning",
          });
          if (coolingOffUntilDayRef.current === null) {
            const coolUntil = dayIdx + 3;
            setCoolingOffUntilDay(coolUntil);
            coolingOffUntilDayRef.current = coolUntil;
          }
        }
        if (d.macd < 0 && d.mfi < 55) {
          addAlert({
            day: dayIdx,
            message: `MACD ${d.macd.toFixed(2)} negative, MFI ${d.mfi.toFixed(1)} weakening`,
            level: "warning",
          });
          if (coolingOffUntilDayRef.current === null) {
            const coolUntil = dayIdx + 3;
            setCoolingOffUntilDay(coolUntil);
            coolingOffUntilDayRef.current = coolUntil;
          }
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

  function handleLoadData() {
    const lines = rawInput.trim().split("\n").filter(Boolean);
    const parsed: DayData[] = lines
      .map((line) => {
        const cols = line.split(/[\t,]+/);
        if (cols.length < 6) return null;
        return {
          price: Number.parseFloat(cols[0]),
          roc21: Number.parseFloat(cols[1]),
          rsi: Number.parseFloat(cols[2]),
          macd: Number.parseFloat(cols[3]),
          mfi: Number.parseFloat(cols[4]),
          momentum: Number.parseFloat(cols[5]),
        } as DayData;
      })
      .filter((d): d is DayData => d !== null && !Number.isNaN(d.price));
    if (parsed.length > 0) {
      resetAll(parsed);
      setDataInputOpen(false);
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
  const prev2Data = currentDay >= 2 ? data[currentDay - 2] : null;
  const prev3Data = currentDay >= 3 ? data[currentDay - 3] : null;

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
                <p className="text-xs text-muted-foreground">
                  Paste tab-separated data: PRICE ROC21 RSI MACD MFI Momentum
                  (one row per day)
                </p>
                <textarea
                  data-ocid="data_input.textarea"
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                  rows={6}
                  className="w-full bg-input border border-border rounded px-3 py-2 text-xs font-mono text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder={
                    "450.5\t3.2\t55.1\t0.8\t62.3\t4.5\n452.1\t3.5\t56.8\t1.1\t64.0\t5.2"
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
              prev2Data={prev2Data}
              prev3Data={prev3Data}
              inPosition={inPosition}
              coolingOffUntilDay={coolingOffUntilDay}
              currentDay={currentDay}
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
