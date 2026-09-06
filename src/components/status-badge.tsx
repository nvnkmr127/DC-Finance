import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
  active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  sent: "bg-blue-100 text-blue-700 border-blue-200",
  partial: "bg-amber-100 text-amber-700 border-amber-200",
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  overdue: "bg-red-100 text-red-700 border-red-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
  draft: "bg-slate-100 text-slate-600 border-slate-200",
  inactive: "bg-slate-100 text-slate-600 border-slate-200",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("capitalize font-medium", styles[status] ?? styles.inactive)}
    >
      {status}
    </Badge>
  );
}
