import { ChevronDown } from "lucide-react";

interface Condition {
  label: string;
  current: string;
  threshold: string;
  met: boolean;
}

interface ExitModuleCardProps {
  title: string;
  accent: string;
  status: "MONITORING" | "ARMED" | "TRIGGERED";
  conditions: Condition[];
  expanded: boolean;
  onToggle: () => void;
}

export function ExitModuleCard({
  title,
  accent,
  status,
  conditions,
  expanded,
  onToggle,
}: ExitModuleCardProps) {
  const statusClass =
    status === "TRIGGERED"
      ? "bg-destructive/20 text-destructive border-destructive/30"
      : status === "ARMED"
        ? "bg-warning/20 text-warning border-warning/30"
        : "bg-muted/30 text-muted-foreground border-border";

  const glowStyle =
    status === "TRIGGERED"
      ? { boxShadow: `0 0 12px ${accent}55` }
      : status === "ARMED"
        ? { boxShadow: `0 0 6px ${accent}33` }
        : {};

  return (
    <div
      className="bg-card border border-border rounded-lg overflow-hidden transition-shadow"
      style={glowStyle}
    >
      <button
        type="button"
        data-ocid="exit_module.card.toggle"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-secondary/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: accent }}
          />
          <span className="text-xs font-medium text-foreground">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-[9px] px-1.5 py-0.5 rounded border font-mono font-bold ${statusClass}`}
          >
            {status}
          </span>
          <ChevronDown
            size={12}
            className={`text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>
      {expanded && (
        <div className="border-t border-border">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-1.5 text-left text-muted-foreground font-medium">
                  Condition
                </th>
                <th className="px-3 py-1.5 text-right text-muted-foreground font-medium">
                  Current
                </th>
                <th className="px-3 py-1.5 text-right text-muted-foreground font-medium">
                  Threshold
                </th>
                <th className="px-2 py-1.5 text-center text-muted-foreground font-medium">
                  Met
                </th>
              </tr>
            </thead>
            <tbody>
              {conditions.map((c) => (
                <tr
                  key={c.label}
                  className="border-b border-border/50 last:border-0"
                >
                  <td className="px-3 py-1.5 font-mono text-foreground">
                    {c.label}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-right text-foreground">
                    {c.current}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-right text-muted-foreground">
                    {c.threshold}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={c.met ? "text-positive" : "text-negative"}>
                      {c.met ? "✓" : "✗"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
