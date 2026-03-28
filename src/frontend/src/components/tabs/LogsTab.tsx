import { useEffect, useRef } from "react";
import type { LogEntry } from "../../lib/playback";

interface LogsTabProps {
  logs: LogEntry[];
  currentDay: number;
}

function logColor(entry: LogEntry) {
  if (entry.type === "entry") return "text-positive";
  if (entry.type === "exit") return "text-negative";
  if (entry.type === "hold") return "text-warning";
  return "text-muted-foreground";
}

export function LogsTab({ logs }: LogsTabProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new logs
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  return (
    <div
      className="min-h-96 max-h-[600px] overflow-y-auto rounded-lg font-mono text-xs"
      style={{
        background: "oklch(0.08 0.005 250)",
        border: "1px solid oklch(0.22 0.01 250)",
      }}
      data-ocid="logs.panel"
    >
      <div className="px-4 py-2 border-b border-border/50 text-[10px] text-muted-foreground">
        EXECUTION LOG — {logs.length} entries
      </div>
      {logs.length === 0 ? (
        <div className="px-4 py-6 text-muted-foreground flex items-center gap-1">
          <span>Awaiting playback</span>
          <span className="cursor-blink">█</span>
        </div>
      ) : (
        <div className="p-3 space-y-0.5">
          {logs.map((entry, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: log entries are append-only
            <div key={i} className={logColor(entry)}>
              <span className="text-muted-foreground">
                [Day {String(entry.day + 1).padStart(3, "0")}]
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
