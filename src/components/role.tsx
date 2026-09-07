"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useSettings } from "@/components/settings-provider";

// True when the signed-in user's email is on the admin-managed expense-only list.
export function useExpenseOnly(): boolean {
  const { session } = useAuth();
  const { settings } = useSettings();
  const email = session?.user?.email?.toLowerCase();
  const list = (settings?.expense_only_emails ?? []).map((e) => e.toLowerCase());
  return !!email && list.includes(email);
}

// Keeps expense-only users on the Expenses page. UI-level guard — pair with RLS
// for a hard boundary (see note in Settings).
export function RoleGuard() {
  const expenseOnly = useExpenseOnly();
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (expenseOnly && pathname !== "/expenses") router.replace("/expenses");
  }, [expenseOnly, pathname, router]);
  return null;
}
