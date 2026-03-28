import { useEffect, useRef } from "react";
import type { AlertEntry } from "../../lib/playback";

interface AlertsTabProps {
  alerts: AlertEntry[];
}

function alertColor(level: AlertEntry["level"]) {
  if (level === "critical") return "text-destructive";
  if (level === "warning") return "text-warning";
  return "text-primary";
}

export function AlertsTab({ alerts }: AlertsTabProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new alerts
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [alerts.length]);

  return (
    <div
      className="min-h-96 max-h-[600px] overflow-y-auto rounded-lg font-mono text-xs"
      style={{
        background: "oklch(0.08 0.005 250)",
        border: "1px solid oklch(0.22 0.01 250)",
      }}
      data-ocid="alerts.log.panel"
    >
      <div className="px-4 py-2 border-b border-border/50 text-[10px] text-muted-foreground">
        ALERT LOG — {alerts.length} entries
      </div>
      {alerts.length === 0 ? (
        <div className="px-4 py-6 text-muted-foreground flex items-center gap-1">
          <span>No alerts triggered</span>
          <span className="cursor-blink">█</span>
        </div>
      ) : (
        <div className="p-3 space-y-0.5">
          {alerts.map((entry, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: log entries are append-only
            <div key={i} className={alertColor(entry.level)}>
              <span className="text-muted-foreground">
                [Day {String(entry.day + 1).padStart(3, "0")}]
              </span>{" "}
              <span className="uppercase font-bold text-[9px]">
                [{entry.level}]
              </span>{" "}
              {entry.message}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
