import type { ReactNode } from "react";
import { GaugeBar } from "./GaugeBar";
import type { Threshold } from "./GaugeBar";

interface IndicatorDetailCardProps {
  title: string;
  icon: ReactNode;
  value: number | null;
  status: "OK" | "WARNING" | "ALERT";
  min: number;
  max: number;
  thresholds: Threshold[];
  color: string;
  description: string;
}

export function IndicatorDetailCard({
  title,
  icon,
  value,
  status,
  min,
  max,
  thresholds,
  color,
  description,
}: IndicatorDetailCardProps) {
  const statusClass =
    status === "ALERT"
      ? "bg-destructive/10 text-destructive border-destructive/30"
      : status === "WARNING"
        ? "bg-warning/10 text-warning border-warning/30"
        : "bg-success/10 text-success border-success/30";

  return (
    <div className="bg-card border border-border rounded-lg p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {icon}
          {title}
        </div>
        <span
          className={`text-[9px] px-1.5 py-0.5 rounded border font-mono font-bold ${statusClass}`}
        >
          {status}
        </span>
      </div>
      <div className="text-2xl font-mono font-bold text-foreground">
        {value !== null ? value.toFixed(1) : "—"}
      </div>
      <GaugeBar
        value={value ?? min}
        min={min}
        max={max}
        thresholds={thresholds}
        color={color}
      />
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}
