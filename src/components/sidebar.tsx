"use client";

import Link from "next/link";
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
  Settings,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";

type NavItem = { href: string; label: string; icon: LucideIcon };

// Grouped by money flow so the menu reads top-to-bottom the way the business runs.
const groups: { title: string; items: NavItem[] }[] = [
  { title: "Overview", items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }] },
  {
    title: "Clients & Work",
    items: [
      { href: "/clients", label: "Clients", icon: Users },
      { href: "/projects", label: "Projects", icon: FolderKanban },
      { href: "/invoices", label: "Invoices", icon: FileText },
    ],
  },
  {
    title: "Money In",
    items: [
      { href: "/payments", label: "Payments", icon: CreditCard },
      { href: "/collections", label: "Collections", icon: BellRing },
    ],
  },
  {
    title: "Money Out",
    items: [
      { href: "/expenses", label: "Expenses", icon: Receipt },
      { href: "/recurring", label: "Recurring", icon: RefreshCw },
      { href: "/salaries", label: "Salaries", icon: Wallet },
    ],
  },
  {
    title: "Planning",
    items: [
      { href: "/budgets", label: "Budgets", icon: Target },
      { href: "/statements", label: "Statements", icon: ScrollText },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/audit", label: "Audit Log", icon: ScrollText },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-4 px-3 pb-4">
      {groups.map((group) => (
        <div key={group.title} className="flex flex-col gap-0.5">
          <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
            {group.title}
          </p>
          {group.items.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                )}
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    active ? "text-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground",
                  )}
                />
                {label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function Sidebar() {
  const { signOut } = useAuth();
  return (
    <aside className="print-hide sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <div className="flex h-16 shrink-0 items-center gap-2.5 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-emerald-600 text-sm font-bold text-primary-foreground shadow-sm">
          D
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-sidebar-foreground">Digicloudify</p>
          <p className="text-xs text-sidebar-foreground/60">Finance</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        <SidebarNav />
      </div>
      <div className="mt-auto flex shrink-0 flex-col gap-1 border-t border-sidebar-border px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-sidebar-foreground/60">Theme</span>
          <ThemeToggle />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="justify-start px-2 text-sidebar-foreground/70 hover:text-sidebar-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
