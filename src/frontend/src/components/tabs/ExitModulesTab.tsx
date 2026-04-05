import type { DayData } from "../../lib/playback";
import { ExitModuleCard } from "../ExitModuleCard";

interface AlphaPeak {
  idx: number;
  price: number;
  rsi: number;
  macd: number;
}

interface ExitModulesTabProps {
  currentData: DayData | null;
  prevData: DayData | null;
  inPosition: boolean;
  coolingOffUntilDay: number | null;
  currentDay: number;
  allData: DayData[];
  alphaPeak: AlphaPeak | null;
}

/**
 * Compute rolling percentile over the last `window` values ending at the
 * tail of `arr`. Returns null if fewer than 5 valid values are available.
 */
function rollingPct(arr: number[], window: number, pct: number): number | null {
  if (arr.length < 5) return null;
  const slice = arr.slice(-window).filter((v) => !Number.isNaN(v));
  if (slice.length < 5) return null;
  const s = [...slice].sort((a, b) => a - b);
  return s[Math.floor(pct * (s.length - 1))];
}

export function ExitModulesTab({
  currentData: d,
  prevData: p,
  inPosition,
  coolingOffUntilDay,
  currentDay,
  allData,
  alphaPeak,
}: ExitModulesTabProps) {
  if (!d) {
    return (
      <div className="py-12 text-center text-muted-foreground text-sm">
        Advance the playback to see module status
      </div>
    );
  }

  // Compute dynamic thresholds from history up to current day
  const rsiHistory = allData.slice(0, currentDay + 1).map((row) => row.rsi);
  const mfiHistory = allData.slice(0, currentDay + 1).map((row) => row.mfi);
  const T_RSI = rollingPct(rsiHistory, 50, 0.85);
  const T_MFI = rollingPct(mfiHistory, 50, 0.85);

  // Rule Alpha — momentum peak identification
  const alphaFired =
    (T_RSI !== null && d.rsi > T_RSI) || (T_MFI !== null && d.mfi > T_MFI);
  const hasPeak = alphaPeak !== null;

  // Rule Beta — ROC21 day-over-day deceleration
  const betaFired = p !== null && d.roc21 < p.roc21;

  // Rule Gamma — price/RSI/MACD divergence vs peak (only meaningful if peak exists and after it)
  const gammaFired =
    hasPeak &&
    currentDay > alphaPeak!.idx &&
    d.price >= alphaPeak!.price &&
    d.rsi < alphaPeak!.rsi &&
    d.macd < alphaPeak!.macd;

  // Final Execution
  const finalFired = hasPeak && betaFired && gammaFired && inPosition;

  // Re-entry scanner state
  const isCooling =
    coolingOffUntilDay !== null && currentDay < coolingOffUntilDay;
  const isScanning =
    coolingOffUntilDay !== null && currentDay >= coolingOffUntilDay;
  const daysRemaining =
    isCooling && coolingOffUntilDay !== null
      ? coolingOffUntilDay - currentDay
      : 0;

  const roc21Met = d.roc21 > 0;
  const rsiMet = d.rsi > 50;
  const mfiMet = d.mfi > 45;
  const macdPositive = d.macd > 0;
  const macdImproving = !!(p && d.macd > p.macd);
  const macdConfirmed = macdPositive || macdImproving;

  return (
    <div className="space-y-2">
      {/* Rule Alpha card */}
      <ExitModuleCard
        title="Rule α · Momentum Peak Identification"
        accent="oklch(0.72 0.20 55)"
        status={alphaFired ? "TRIGGERED" : hasPeak ? "ARMED" : "MONITORING"}
        conditions={[
          {
            label: "RSI > Dynamic Upper (85th pct)",
            current: d.rsi.toFixed(1),
            threshold: T_RSI !== null ? T_RSI.toFixed(1) : "calculating…",
            met: T_RSI !== null && d.rsi > T_RSI,
          },
          {
            label: "MFI > Dynamic Upper (85th pct)",
            current: d.mfi.toFixed(1),
            threshold: T_MFI !== null ? T_MFI.toFixed(1) : "calculating…",
            met: T_MFI !== null && d.mfi > T_MFI,
          },
          {
            label: "Peak Recorded",
            current: hasPeak
              ? `Day ${alphaPeak!.idx + 1} @ $${alphaPeak!.price.toFixed(2)}`
              : "None",
            threshold: "Required",
            met: hasPeak,
          },
        ]}
        expanded
        onToggle={() => {}}
      />

      {/* Rule Beta card */}
      <ExitModuleCard
        title="Rule β · Breakdown Confirmation"
        accent="oklch(0.65 0.22 25)"
        status={
          betaFired && hasPeak ? "TRIGGERED" : hasPeak ? "ARMED" : "MONITORING"
        }
        conditions={[
          {
            label: "ROC21 Decelerating",
            current: `${d.roc21.toFixed(2)}%`,
            threshold: `< ${p?.roc21.toFixed(2) ?? "prev"}%`,
            met: betaFired,
          },
          {
            label: "Peak Exists",
            current: hasPeak ? "Yes" : "No",
            threshold: "Required",
            met: hasPeak,
          },
        ]}
        expanded
        onToggle={() => {}}
      />

      {/* Rule Gamma card */}
      <ExitModuleCard
        title="Rule γ · Divergence-Decay Quantification"
        accent="oklch(0.65 0.15 265)"
        status={gammaFired ? "TRIGGERED" : hasPeak ? "ARMED" : "MONITORING"}
        conditions={[
          {
            label: "Price ≥ Peak Price",
            current: `$${d.price.toFixed(2)}`,
            threshold: hasPeak
              ? `≥ $${alphaPeak!.price.toFixed(2)}`
              : "Need peak",
            met: hasPeak && d.price >= alphaPeak!.price,
          },
          {
            label: "RSI < Peak RSI",
            current: d.rsi.toFixed(1),
            threshold: hasPeak ? `< ${alphaPeak!.rsi.toFixed(1)}` : "Need peak",
            met: hasPeak && d.rsi < alphaPeak!.rsi,
          },
          {
            label: "MACD < Peak MACD",
            current: d.macd.toFixed(3),
            threshold: hasPeak
              ? `< ${alphaPeak!.macd.toFixed(3)}`
              : "Need peak",
            met: hasPeak && d.macd < alphaPeak!.macd,
          },
        ]}
        expanded
        onToggle={() => {}}
      />

      {/* Final Execution banner */}
      <div
        className={`mt-2 rounded-lg border px-4 py-3 text-sm font-semibold flex items-center gap-3 ${
          finalFired
            ? "bg-destructive/15 border-destructive/50 text-destructive"
            : hasPeak && betaFired && gammaFired
              ? "bg-warning/15 border-warning/50 text-warning"
              : "bg-muted/20 border-border text-muted-foreground"
        }`}
        data-ocid="exit_modules.final_execution.panel"
      >
        <span
          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
            finalFired
              ? "bg-destructive animate-pulse"
              : hasPeak
                ? "bg-warning/60"
                : "bg-muted-foreground/40"
          }`}
        />
        <span>
          FINAL EXECUTION:{" "}
          {finalFired
            ? "🚨 EXIT SIGNAL ACTIVE"
            : hasPeak && betaFired && gammaFired
              ? "⚠ CONDITIONS ALIGNED — MONITORING"
              : hasPeak
                ? "Monitoring for Beta+Gamma alignment"
                : "Waiting for Alpha peak identification"}
        </span>
        <span className="ml-auto text-[10px] font-mono">
          α:{hasPeak ? "✓" : "✗"} β:{betaFired ? "✓" : "✗"} γ:
          {gammaFired ? "✓" : "✗"}
        </span>
      </div>

      {/* Re-entry Scanner — only shown when not in position */}
      {!inPosition && (
        <div className="mt-4 rounded-lg border border-border bg-card overflow-hidden">
          {/* Header */}
          <div
            className={`px-3 py-2 flex items-center gap-2 text-xs font-semibold tracking-wider border-b border-border ${
              isCooling
                ? "bg-warning/10 text-warning"
                : isScanning
                  ? "bg-blue-500/10 text-blue-400"
                  : "bg-muted/20 text-muted-foreground"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isCooling
                  ? "bg-warning animate-pulse"
                  : isScanning
                    ? "bg-blue-400 animate-pulse"
                    : "bg-muted-foreground"
              }`}
            />
            RE-ENTRY SCANNER
            <span className="ml-auto font-mono">
              {isCooling
                ? `COOLING OFF — ${daysRemaining} day(s) remaining`
                : isScanning
                  ? "SCANNING"
                  : "IDLE"}
            </span>
          </div>

          {/* Condition rows */}
          <div className="divide-y divide-border">
            {/* Step 1 info */}
            {isCooling && (
              <div className="px-3 py-2 text-[10px] text-muted-foreground font-mono">
                Step 1: Cooling-off period active. Re-entry scan begins day{" "}
                {coolingOffUntilDay}.
              </div>
            )}

            {/* Step 2 conditions */}
            <div className="px-3 py-2">
              <div className="text-[10px] text-muted-foreground mb-1.5 font-medium tracking-wide">
                STEP 2 — All 3 must be true simultaneously
              </div>
              <div className="space-y-1">
                {[
                  {
                    label: "ROC21",
                    value: d.roc21.toFixed(1),
                    threshold: "> 0",
                    met: roc21Met,
                  },
                  {
                    label: "RSI",
                    value: d.rsi.toFixed(1),
                    threshold: "> 50",
                    met: rsiMet,
                  },
                  {
                    label: "MFI",
                    value: d.mfi.toFixed(1),
                    threshold: "> 45",
                    met: mfiMet,
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center gap-2 text-xs font-mono"
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        row.met ? "bg-success" : "bg-destructive"
                      }`}
                    />
                    <span className="w-12 text-muted-foreground">
                      {row.label}
                    </span>
                    <span
                      className={`w-12 font-semibold ${
                        row.met ? "text-success" : "text-foreground"
                      }`}
                    >
                      {row.value}
                    </span>
                    <span className="text-muted-foreground text-[10px]">
                      {row.threshold}
                    </span>
                    <span
                      className={`ml-auto text-[10px] font-semibold ${
                        row.met ? "text-success" : "text-destructive"
                      }`}
                    >
                      {row.met ? "✓ MET" : "✗ NOT MET"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 3 optional MACD */}
            <div className="px-3 py-2">
              <div className="text-[10px] text-muted-foreground mb-1.5 font-medium tracking-wide">
                STEP 3 — Optional MACD Confirmation
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    macdConfirmed ? "bg-success" : "bg-muted-foreground"
                  }`}
                />
                <span className="w-12 text-muted-foreground">MACD</span>
                <span
                  className={`w-12 font-semibold ${
                    macdConfirmed ? "text-success" : "text-foreground"
                  }`}
                >
                  {d.macd.toFixed(3)}
                </span>
                <span className="text-muted-foreground text-[10px]">
                  {macdPositive
                    ? "positive"
                    : macdImproving
                      ? `improving (prev: ${p?.macd.toFixed(3)})`
                      : "negative/flat"}
                </span>
                <span
                  className={`ml-auto text-[10px] font-semibold ${
                    macdConfirmed ? "text-success" : "text-muted-foreground"
                  }`}
                >
                  {macdConfirmed ? "✓ CONFIRMED" : "— optional"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
