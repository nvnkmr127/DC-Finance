import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { formatINR } from "@/lib/format";

export function StatCard({
  title,
  value,
  icon: Icon,
  hint,
  accent = "default",
  delta,
  invertDelta = false,
}: {
  title: string;
  value: number;
  icon: LucideIcon;
  hint?: string;
  accent?: "default" | "positive" | "negative" | "warning";
  delta?: number; // signed % change vs previous period
  invertDelta?: boolean; // true when a rise is bad (e.g. expenses)
}) {
  const accentColor = {
    default: "text-foreground",
    positive: "text-emerald-600",
    negative: "text-red-600",
    warning: "text-amber-600",
  }[accent];

  const deltaGood = delta === undefined ? true : invertDelta ? delta < 0 : delta >= 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-2">
          <div className={cn("text-2xl font-semibold tracking-tight", accentColor)}>
            {formatINR(value)}
          </div>
          {delta !== undefined && (
            <span
              className={cn(
                "flex items-center gap-0.5 text-xs font-medium",
                deltaGood ? "text-emerald-600" : "text-red-600",
              )}
            >
              {delta >= 0 ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" />
              )}
              {Math.abs(delta)}%
            </span>
          )}
        </div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
