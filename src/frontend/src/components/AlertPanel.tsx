import { ChevronDown, Zap } from "lucide-react";
import type { AlertEntry } from "../lib/playback";

interface AlertPanelProps {
  alerts: AlertEntry[];
  isOpen: boolean;
  onToggle: () => void;
}

export function AlertPanel({ alerts, isOpen, onToggle }: AlertPanelProps) {
  const recent = alerts.slice(-5).reverse();
  const levelColor = (level: AlertEntry["level"]) =>
    level === "critical"
      ? "text-destructive"
      : level === "warning"
        ? "text-warning"
        : "text-primary";

  return (
    <div className="fixed bottom-16 right-4 z-40 w-72">
      <button
        type="button"
        data-ocid="alerts.panel.toggle"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 bg-card border border-border rounded-t-lg text-xs font-medium text-foreground hover:bg-secondary/30 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Zap size={12} className="text-warning" />
          Live Alerts ({alerts.length})
        </span>
        <ChevronDown
          size={12}
          className={`transition-transform ${isOpen ? "" : "rotate-180"}`}
        />
      </button>
      {isOpen && (
        <div className="bg-card border border-t-0 border-border rounded-b-lg overflow-hidden">
          {recent.length === 0 ? (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">
              No alerts yet
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recent.map((a, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: reversed recent slice, index is stable display position
                <div key={i} className="px-3 py-2">
                  <div className="flex items-center justify-between mb-0.5">
                    <span
                      className={`text-[9px] font-mono font-bold uppercase ${levelColor(a.level)}`}
                    >
                      {a.level}
                    </span>
                    <span className="text-[9px] font-mono text-muted-foreground">
                      Day {a.day + 1}
                    </span>
                  </div>
                  <p className="text-[10px] text-foreground leading-tight">
                    {a.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
