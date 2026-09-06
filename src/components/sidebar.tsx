"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FileText,
  CreditCard,
  BellRing,
  Receipt,
  RefreshCw,
  Wallet,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/collections", label: "Collections", icon: BellRing },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/recurring", label: "Recurring", icon: RefreshCw },
  { href: "/salaries", label: "Salaries", icon: Wallet },
  { href: "/statements", label: "Statements", icon: Receipt },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 px-3">
      <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
        Menu
      </p>
      {nav.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const { signOut } = useAuth();
  return (
    <aside className="print-hide hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <div className="flex h-16 items-center gap-2 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
          D
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-sidebar-foreground">Digicloudify</p>
          <p className="text-xs text-sidebar-foreground/60">Finance</p>
        </div>
      </div>
      <div className="py-2">
        <SidebarNav />
      </div>
      <div className="mt-auto flex flex-col gap-1 border-t border-sidebar-border px-4 py-3">
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
