"use client";

import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  FileText,
  CreditCard,
  BellRing,
  Receipt,
  RefreshCw,
  Wallet,
  Target,
  ScrollText,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

// Route → icon, so every page header shows its section glyph without each page
// passing one. Longest prefix wins (e.g. /clients/[id] still resolves to Clients).
const ICONS: [string, LucideIcon][] = [
  ["/clients", Users],
  ["/projects", FolderKanban],
  ["/invoices", FileText],
  ["/payments", CreditCard],
  ["/collections", BellRing],
  ["/expenses", Receipt],
  ["/recurring", RefreshCw],
  ["/salaries", Wallet],
  ["/budgets", Target],
  ["/statements", ScrollText],
  ["/reports", BarChart3],
  ["/audit", ScrollText],
  ["/settings", Settings],
];

function iconFor(pathname: string): LucideIcon {
  if (pathname === "/") return LayoutDashboard;
  return ICONS.find(([p]) => pathname.startsWith(p))?.[1] ?? LayoutDashboard;
}

export function PageHeader({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: LucideIcon; // override the route-derived icon if needed
}) {
  const pathname = usePathname();
  const Icon = icon ?? iconFor(pathname);
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-emerald-500/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}
