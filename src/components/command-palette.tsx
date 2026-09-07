"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, FolderKanban, FileText, CreditCard, BellRing,
  Receipt, RefreshCw, Wallet, Target, ScrollText, BarChart3, Settings, Search,
  type LucideIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Dest = { href: string; label: string; group: string; icon: LucideIcon };

const DESTINATIONS: Dest[] = [
  { href: "/", label: "Dashboard", group: "Overview", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", group: "Clients & Work", icon: Users },
  { href: "/projects", label: "Projects", group: "Clients & Work", icon: FolderKanban },
  { href: "/invoices", label: "Invoices", group: "Clients & Work", icon: FileText },
  { href: "/payments", label: "Payments", group: "Money In", icon: CreditCard },
  { href: "/collections", label: "Collections", group: "Money In", icon: BellRing },
  { href: "/expenses", label: "Expenses", group: "Money Out", icon: Receipt },
  { href: "/recurring", label: "Recurring", group: "Money Out", icon: RefreshCw },
  { href: "/salaries", label: "Salaries", group: "Money Out", icon: Wallet },
  { href: "/budgets", label: "Budgets", group: "Planning", icon: Target },
  { href: "/statements", label: "Statements", group: "Planning", icon: ScrollText },
  { href: "/reports", label: "Reports", group: "Planning", icon: BarChart3 },
  { href: "/audit", label: "Audit Log", group: "System", icon: ScrollText },
  { href: "/settings", label: "Settings", group: "System", icon: Settings },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // ⌘K / Ctrl+K toggles the palette from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? DESTINATIONS.filter((d) => d.label.toLowerCase().includes(q) || d.group.toLowerCase().includes(q)) : DESTINATIONS;
  }, [query]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => { if (open) { setQuery(""); setActive(0); } }, [open]);

  function go(d?: Dest) {
    if (!d) return;
    setOpen(false);
    router.push(d.href);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[20%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              else if (e.key === "Enter") { e.preventDefault(); go(results[active]); }
            }}
            placeholder="Jump to a page…"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div ref={listRef} className="max-h-80 overflow-y-auto p-1">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matches</p>
          ) : (
            results.map((d, i) => {
              const Icon = d.icon;
              return (
                <button
                  key={d.href}
                  onClick={() => go(d)}
                  onMouseMove={() => setActive(i)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm",
                    i === active ? "bg-accent text-accent-foreground" : "text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1">{d.label}</span>
                  <span className="text-xs text-muted-foreground">{d.group}</span>
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
