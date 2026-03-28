import { Activity } from "lucide-react";
import type { DayData, TradeRecord } from "../lib/playback";

interface HeaderProps {
  sessionStart: Date;
  elapsed: number;
  currentData: DayData | null;
  openTrade: TradeRecord | null;
  pnl: number;
  daysHeld: number;
  speed: 1 | 2 | 5;
  onSpeedChange: (s: 1 | 2 | 5) => void;
}

function fmt(v: number | null | undefined, decimals = 2) {
  if (v === null || v === undefined) return "—";
  return v.toFixed(decimals);
}

function fmtTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function Header({
  elapsed,
  currentData,
  openTrade,
  pnl,
  daysHeld,
  speed,
  onSpeedChange,
}: HeaderProps) {
  const isActive = openTrade !== null;
  const pnlColor =
    pnl > 0
      ? "text-positive"
      : pnl < 0
        ? "text-negative"
        : "text-muted-foreground";

  return (
    <header
      className="sticky top-0 z-50 h-14 flex items-center justify-between px-4 border-b border-border backdrop-blur-md"
      style={{
        background:
          "linear-gradient(135deg, oklch(0.17 0.06 260 / 0.95) 0%, oklch(0.15 0.05 280 / 0.95) 100%)",
        boxShadow: "0 1px 20px oklch(0.76 0.19 195 / 0.12)",
      }}
    >
      {/* Left */}
      <div className="flex items-center gap-2 min-w-0">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.76 0.19 195 / 0.3) 0%, oklch(0.65 0.20 285 / 0.3) 100%)",
            border: "1px solid oklch(0.76 0.19 195 / 0.4)",
            boxShadow: "0 0 12px oklch(0.76 0.19 195 / 0.2)",
          }}
        >
          <Activity size={15} className="text-primary" />
        </div>
        <span className="font-bold text-sm tracking-tight text-foreground">
          QuantViz
        </span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded font-mono"
          style={{
            background: "oklch(0.76 0.19 195 / 0.15)",
            border: "1px solid oklch(0.76 0.19 195 / 0.35)",
            color: "oklch(0.76 0.19 195)",
          }}
        >
          v2.0
        </span>
        <span
          className="w-2 h-2 rounded-full animate-pulse"
          style={{
            background: "oklch(0.78 0.22 145)",
            boxShadow: "0 0 6px oklch(0.78 0.22 145 / 0.8)",
          }}
        />
        <span className="text-xs font-mono text-muted-foreground">
          {fmtTime(elapsed)}
        </span>
      </div>

      {/* Center chips */}
      <div className="hidden md:flex items-center gap-2">
        {[
          {
            label: "Entry $",
            value: openTrade ? `$${fmt(openTrade.entryPrice)}` : "—",
          },
          {
            label: "Current $",
            value: currentData ? `$${fmt(currentData.price)}` : "—",
          },
          {
            label: "P&L %",
            value: openTrade ? `${pnl >= 0 ? "+" : ""}${fmt(pnl)}%` : "—",
            color: openTrade ? pnlColor : "",
            highlight: openTrade
              ? pnl > 0
                ? "positive"
                : pnl < 0
                  ? "negative"
                  : ""
              : "",
          },
          { label: "Days Held", value: openTrade ? `${daysHeld}d` : "—" },
        ].map((chip) => {
          const bgStyle =
            chip.highlight === "positive"
              ? {
                  background: "oklch(0.78 0.22 145 / 0.10)",
                  borderColor: "oklch(0.78 0.22 145 / 0.35)",
                }
              : chip.highlight === "negative"
                ? {
                    background: "oklch(0.65 0.26 25 / 0.10)",
                    borderColor: "oklch(0.65 0.26 25 / 0.35)",
                  }
                : {
                    background: "oklch(0.17 0.045 258 / 0.7)",
                    borderColor: "oklch(0.28 0.06 258)",
                  };
          return (
            <div
              key={chip.label}
              className="flex flex-col items-center px-3 py-1 rounded-lg border min-w-[76px]"
              style={bgStyle}
            >
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                {chip.label}
              </span>
              <span
                className={`text-xs font-mono font-semibold ${chip.color ?? "text-foreground"}`}
              >
                {chip.value}
              </span>
            </div>
          );
        })}
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <span
          className="text-[10px] px-2.5 py-1 rounded-full border font-medium"
          style={
            isActive
              ? {
                  background: "oklch(0.78 0.22 145 / 0.15)",
                  color: "oklch(0.78 0.22 145)",
                  borderColor: "oklch(0.78 0.22 145 / 0.4)",
                  boxShadow: "0 0 8px oklch(0.78 0.22 145 / 0.2)",
                }
              : {
                  background: "oklch(0.20 0.04 260 / 0.5)",
                  color: "oklch(0.62 0.04 255)",
                  borderColor: "oklch(0.28 0.06 258)",
                }
          }
        >
          {isActive ? "● ACTIVE" : "IDLE"}
        </span>
        <div
          className="flex items-center gap-0.5 rounded-lg p-0.5"
          style={{
            background: "oklch(0.17 0.045 258)",
            border: "1px solid oklch(0.28 0.06 258)",
          }}
        >
          {([1, 2, 5] as const).map((s) => (
            <button
              key={s}
              type="button"
              data-ocid={`header.speed.${s}x.toggle`}
              onClick={() => onSpeedChange(s)}
              className="text-[10px] px-2.5 py-0.5 rounded-md font-mono transition-all"
              style={
                speed === s
                  ? {
                      background:
                        "linear-gradient(135deg, oklch(0.76 0.19 195) 0%, oklch(0.65 0.20 285) 100%)",
                      color: "oklch(0.08 0.005 250)",
                      boxShadow: "0 0 8px oklch(0.76 0.19 195 / 0.4)",
                    }
                  : {}
              }
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
