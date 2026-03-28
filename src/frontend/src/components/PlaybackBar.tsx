import { Pause, Play, RotateCcw } from "lucide-react";

interface PlaybackBarProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onReset: () => void;
  speed: 1 | 2 | 5;
  onSpeedChange: (s: 1 | 2 | 5) => void;
  currentDay: number;
  totalDays: number;
  cbStatus: "OK" | "ARMED" | "TRIGGERED";
  pnl: number;
}

export function PlaybackBar({
  isPlaying,
  onPlayPause,
  onReset,
  speed,
  onSpeedChange,
  currentDay,
  totalDays,
  cbStatus,
  pnl,
}: PlaybackBarProps) {
  const progress = totalDays > 0 ? (currentDay / (totalDays - 1)) * 100 : 0;
  const pnlColor =
    pnl > 0
      ? "text-positive"
      : pnl < 0
        ? "text-negative"
        : "text-muted-foreground";

  const cbStyle =
    cbStatus === "TRIGGERED"
      ? {
          background: "oklch(0.65 0.26 25 / 0.2)",
          color: "oklch(0.65 0.26 25)",
          borderColor: "oklch(0.65 0.26 25 / 0.5)",
          boxShadow: "0 0 8px oklch(0.65 0.26 25 / 0.3)",
        }
      : cbStatus === "ARMED"
        ? {
            background: "oklch(0.84 0.20 75 / 0.18)",
            color: "oklch(0.84 0.20 75)",
            borderColor: "oklch(0.84 0.20 75 / 0.5)",
          }
        : {
            background: "oklch(0.78 0.22 145 / 0.12)",
            color: "oklch(0.78 0.22 145)",
            borderColor: "oklch(0.78 0.22 145 / 0.4)",
          };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 h-14 flex items-center px-4 gap-3 border-t"
      style={{
        background:
          "linear-gradient(0deg, oklch(0.13 0.05 262 / 0.98) 0%, oklch(0.16 0.045 260 / 0.97) 100%)",
        borderColor: "oklch(0.28 0.06 258)",
        backdropFilter: "blur(12px)",
        boxShadow: "0 -1px 24px oklch(0.76 0.19 195 / 0.08)",
      }}
    >
      {/* Play/Pause */}
      <button
        type="button"
        data-ocid="playback.play_pause.button"
        onClick={onPlayPause}
        className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-105"
        style={{
          background: isPlaying
            ? "linear-gradient(135deg, oklch(0.65 0.26 25 / 0.25) 0%, oklch(0.65 0.26 25 / 0.1) 100%)"
            : "linear-gradient(135deg, oklch(0.76 0.19 195 / 0.25) 0%, oklch(0.65 0.20 285 / 0.15) 100%)",
          border: isPlaying
            ? "1px solid oklch(0.65 0.26 25 / 0.5)"
            : "1px solid oklch(0.76 0.19 195 / 0.5)",
          color: isPlaying ? "oklch(0.65 0.26 25)" : "oklch(0.76 0.19 195)",
          boxShadow: isPlaying
            ? "0 0 12px oklch(0.65 0.26 25 / 0.25)"
            : "0 0 12px oklch(0.76 0.19 195 / 0.25)",
        }}
      >
        {isPlaying ? <Pause size={15} /> : <Play size={15} />}
      </button>

      {/* Reset */}
      <button
        type="button"
        data-ocid="playback.reset.button"
        onClick={onReset}
        className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-105"
        style={{
          background: "oklch(0.22 0.06 268 / 0.6)",
          border: "1px solid oklch(0.28 0.06 258)",
          color: "oklch(0.62 0.04 255)",
        }}
      >
        <RotateCcw size={12} />
      </button>

      <div
        className="h-5 w-px"
        style={{ background: "oklch(0.28 0.06 258)" }}
      />

      {/* Speed */}
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
            data-ocid={`playback.speed.${s}x.toggle`}
            onClick={() => onSpeedChange(s)}
            className="text-[10px] px-2.5 py-0.5 rounded font-mono transition-all"
            style={
              speed === s
                ? {
                    background:
                      "linear-gradient(135deg, oklch(0.76 0.19 195) 0%, oklch(0.65 0.20 285) 100%)",
                    color: "oklch(0.08 0.005 250)",
                    boxShadow: "0 0 8px oklch(0.76 0.19 195 / 0.35)",
                  }
                : { color: "oklch(0.62 0.04 255)" }
            }
          >
            {s}×
          </button>
        ))}
      </div>

      {/* Progress */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <div
          className="flex-1 h-2 rounded-full overflow-hidden"
          style={{ background: "oklch(0.22 0.05 260)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progress}%`,
              background:
                "linear-gradient(90deg, oklch(0.76 0.19 195) 0%, oklch(0.65 0.20 285) 100%)",
              boxShadow: "0 0 8px oklch(0.76 0.19 195 / 0.5)",
            }}
          />
        </div>
        <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
          Day {currentDay + 1}/{totalDays}
        </span>
      </div>

      {/* CB Status */}
      <span
        className="text-[10px] px-2.5 py-1 rounded-lg border font-mono font-medium"
        style={cbStyle}
      >
        CB: {cbStatus}
      </span>

      {/* P&L */}
      <span
        className={`text-sm font-mono font-bold ${pnlColor}`}
        style={{
          textShadow:
            pnl > 0
              ? "0 0 12px oklch(0.78 0.22 145 / 0.6)"
              : pnl < 0
                ? "0 0 12px oklch(0.65 0.26 25 / 0.6)"
                : "none",
        }}
      >
        {pnl >= 0 ? "+" : ""}
        {pnl.toFixed(2)}%
      </span>
    </div>
  );
}
