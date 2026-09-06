"use client";

import { Menu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SidebarNav } from "@/components/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useSettings } from "@/components/settings-provider";
import { useAuth } from "@/components/auth-provider";

import { useState } from "react";

export function Topbar() {
  const [open, setOpen] = useState(false);
  const { settings } = useSettings();
  const { signOut } = useAuth();

  return (
    <header className="print-hide flex h-16 items-center gap-3 border-b bg-background px-4 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="h-16 justify-center px-6">
            <SheetTitle>{settings?.company_name || "Digicloudify Finance"}</SheetTitle>
          </SheetHeader>
          <div className="py-2">
            <SidebarNav onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
      <span className="font-semibold">{settings?.company_name || "Digicloudify Finance"}</span>
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={signOut}>
          <LogOut className="h-5 w-5" />
          <span className="sr-only">Sign out</span>
        </Button>
      </div>
    </header>
  );
}
