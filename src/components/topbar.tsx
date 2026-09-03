"use client";

import { Menu } from "lucide-react";
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

export function Topbar() {
  return (
    <header className="flex h-16 items-center gap-3 border-b bg-background px-4 md:hidden">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="h-16 justify-center px-6">
            <SheetTitle>Digicloudify Finance</SheetTitle>
          </SheetHeader>
          <div className="py-2">
            <SidebarNav />
          </div>
        </SheetContent>
      </Sheet>
      <span className="font-semibold">Digicloudify Finance</span>
      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </header>
  );
}
