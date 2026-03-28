import { useState } from "react";
import type { DayData } from "../../lib/playback";
import { ExitModuleCard } from "../ExitModuleCard";

interface ExitModulesTabProps {
  currentData: DayData | null;
  prevData: DayData | null;
  prev2Data: DayData | null;
  prev3Data: DayData | null;
  inPosition: boolean;
  coolingOffUntilDay: number | null;
  currentDay: number;
}

type ModuleStatus = "MONITORING" | "ARMED" | "TRIGGERED";

function getStatus(triggered: boolean, armed: boolean): ModuleStatus {
  if (triggered) return "TRIGGERED";
  if (armed) return "ARMED";
  return "MONITORING";
}

export function ExitModulesTab({
  currentData: d,
  prevData: p,
  prev2Data: p2,
  prev3Data: p3,
  inPosition,
  coolingOffUntilDay,
  currentDay,
}: ExitModulesTabProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "1": true,
  });
  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  if (!d) {
    return (
      <div className="py-12 text-center text-muted-foreground text-sm">
        Advance the playback to see module status
      </div>
    );
  }

  // Hold check
  const momDrop3 = p3 ? p3.momentum - d.momentum : 0;
  const holdActive = d.rsi >= 48 && d.roc21 > -5 && momDrop3 <= 5;

  // Module 1: Profit-Take
  const pt1 = d.roc21 > 15;
  const pt2 = d.rsi > 75 || d.mfi > 80;
  const ptTriggered = !holdActive && pt1 && pt2;

  // Module 2: Momentum Collapse
  const mc1 = d.roc21 < 0;
  const mc2 = !!(
    p &&
    p2 &&
    d.momentum < p.momentum &&
    p.momentum < p2.momentum
  );
  const mc3 = !!(p2 && p2.momentum - d.momentum > 8);
  const mcTriggered = !holdActive && mc1 && mc2 && mc3;

  // Module 3: RSI Divergence
  const rd1 = d.rsi > 72;
  const rd2 = !!(p && p2 && d.rsi < p.rsi && p.rsi < p2.rsi);
  const rd3 = d.mfi < 50;
  const rdTriggered = !holdActive && rd1 && rd2 && rd3;

  // Module 4: MACD+MFI
  const mm1 = d.macd < 0;
  const mm2 = d.mfi < 45;
  const mm3 = !!(p && d.momentum < p.momentum);
  const mmTriggered = !holdActive && mm1 && mm2 && mm3;

  const modules = [
    {
      key: "1",
      title: "1 · Profit-Take",
      accent: "oklch(0.72 0.18 140)",
      status: getStatus(ptTriggered && inPosition, pt1 || pt2),
      conditions: [
        {
          label: "ROC21 > 15",
          current: `${d.roc21.toFixed(2)}%`,
          threshold: "> 15%",
          met: pt1,
        },
        {
          label: "RSI > 75",
          current: d.rsi.toFixed(1),
          threshold: "> 75",
          met: d.rsi > 75,
        },
        {
          label: "MFI > 80",
          current: d.mfi.toFixed(1),
          threshold: "> 80",
          met: d.mfi > 80,
        },
      ],
    },
    {
      key: "2",
      title: "2 · Momentum Collapse",
      accent: "oklch(0.65 0.22 25)",
      status: getStatus(mcTriggered && inPosition, mc1),
      conditions: [
        {
          label: "ROC21 < 0",
          current: `${d.roc21.toFixed(2)}%`,
          threshold: "< 0%",
          met: mc1,
        },
        {
          label: "3-day decline",
          current: mc2 ? "Yes" : "No",
          threshold: "Yes",
          met: mc2,
        },
        {
          label: "Drop > 8pts",
          current: (p2 ? p2.momentum - d.momentum : 0).toFixed(2),
          threshold: "> 8",
          met: mc3,
        },
      ],
    },
    {
      key: "3",
      title: "3 · RSI Divergence",
      accent: "oklch(0.78 0.18 75)",
      status: getStatus(rdTriggered && inPosition, rd1),
      conditions: [
        {
          label: "RSI > 72",
          current: d.rsi.toFixed(1),
          threshold: "> 72",
          met: rd1,
        },
        {
          label: "3-day RSI fall",
          current: rd2 ? "Yes" : "No",
          threshold: "Yes",
          met: rd2,
        },
        {
          label: "MFI < 50",
          current: d.mfi.toFixed(1),
          threshold: "< 50",
          met: rd3,
        },
      ],
    },
    {
      key: "4",
      title: "4 · MACD+MFI",
      accent: "oklch(0.65 0.15 265)",
      status: getStatus(mmTriggered && inPosition, mm1 || mm2),
      conditions: [
        {
          label: "MACD < 0",
          current: d.macd.toFixed(3),
          threshold: "< 0",
          met: mm1,
        },
        {
          label: "MFI < 45",
          current: d.mfi.toFixed(1),
          threshold: "< 45",
          met: mm2,
        },
        {
          label: "Momentum falling",
          current: mm3 ? "Yes" : "No",
          threshold: "Yes",
          met: mm3,
        },
      ],
    },
    {
      key: "5",
      title: "5 · Multi-Weak",
      accent: "oklch(0.72 0.15 195)",
      status: getStatus(
        !holdActive && d.roc21 < -3 && (d.rsi < 45 || d.mfi < 45) && inPosition,
        d.roc21 < -1,
      ),
      conditions: [
        {
          label: "ROC21 < -3",
          current: `${d.roc21.toFixed(2)}%`,
          threshold: "< -3%",
          met: d.roc21 < -3,
        },
        {
          label: "RSI < 45",
          current: d.rsi.toFixed(1),
          threshold: "< 45",
          met: d.rsi < 45,
        },
        {
          label: "MFI < 45",
          current: d.mfi.toFixed(1),
          threshold: "< 45",
          met: d.mfi < 45,
        },
      ],
    },
    {
      key: "6",
      title: "6 · Hard Floor",
      accent: "oklch(0.65 0.22 25)",
      status: getStatus(
        !holdActive && d.roc21 < -9 && inPosition,
        d.roc21 < -5,
      ),
      conditions: [
        {
          label: "ROC21 < -9",
          current: `${d.roc21.toFixed(2)}%`,
          threshold: "< -9%",
          met: d.roc21 < -9,
        },
      ],
    },
  ];

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
      {/* Hold status */}
      <div
        className={`px-3 py-2 rounded border text-xs font-medium flex items-center gap-2 ${
          holdActive
            ? "bg-success/10 text-success border-success/30"
            : "bg-muted/30 text-muted-foreground border-border"
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full ${holdActive ? "bg-success" : "bg-muted-foreground"}`}
        />
        HOLD OVERRIDE:{" "}
        {holdActive
          ? "ACTIVE — exit evaluation skipped"
          : "INACTIVE — exits evaluated"}
        {d && (
          <span className="ml-auto text-[10px] font-mono">
            RSI {d.rsi.toFixed(1)} | ROC21 {d.roc21.toFixed(1)} | MomDrop{" "}
            {momDrop3.toFixed(1)}
          </span>
        )}
      </div>

      {/* Module cards */}
      {modules.map((m) => (
        <ExitModuleCard
          key={m.key}
          title={m.title}
          accent={m.accent}
          status={m.status}
          conditions={m.conditions}
          expanded={!!expanded[m.key]}
          onToggle={() => toggle(m.key)}
        />
      ))}

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
