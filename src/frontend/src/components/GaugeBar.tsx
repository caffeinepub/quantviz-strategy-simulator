export interface Threshold {
  value: number;
  color: string;
  label?: string;
}

interface GaugeBarProps {
  label?: string;
  value: number;
  min: number;
  max: number;
  color?: string;
  warningThreshold?: number;
  alertThreshold?: number;
  thresholds?: Threshold[];
}

export function GaugeBar({
  label,
  value,
  min,
  max,
  color = "oklch(0.76 0.19 195)",
  warningThreshold,
  alertThreshold,
}: GaugeBarProps) {
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  const barColor =
    alertThreshold !== undefined && value >= alertThreshold
      ? "oklch(0.65 0.26 25)"
      : warningThreshold !== undefined && value >= warningThreshold
        ? "oklch(0.84 0.20 75)"
        : color;

  const glowColor = barColor.endsWith(")")
    ? `${barColor.slice(0, -1)} / 0.45)`
    : barColor;

  return (
    <div className="flex items-center gap-2">
      {label && (
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground w-16 shrink-0">
          {label}
        </span>
      )}
      <div
        className="flex-1 h-2 rounded-full overflow-hidden"
        style={{ background: "oklch(0.20 0.04 260)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: barColor,
            boxShadow: `0 0 6px ${glowColor}`,
          }}
        />
      </div>
      {label && (
        <span
          className="text-[10px] font-mono font-semibold w-10 text-right"
          style={{ color: barColor }}
        >
          {value.toFixed(1)}
        </span>
      )}
    </div>
  );
}
