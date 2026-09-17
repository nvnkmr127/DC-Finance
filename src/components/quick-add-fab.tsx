"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  X,
  CreditCard,
  Receipt,
  Users,
  Wallet,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaymentForm, type PaymentInvoiceOption, type PaymentProjectOption } from "@/components/payment-form";
import { ExpenseForm } from "@/components/expense-form";
import { ClientForm } from "@/components/client-form";
import { SalaryPaymentForm } from "@/components/salary-payment-form";
import { RecurringForm } from "@/components/recurring-form";
import { listClients, type ClientSummary } from "@/lib/clients";
import { listInvoices } from "@/lib/invoices";
import { listProjects } from "@/lib/projects";
import { listEmployees, listSalaryPayments } from "@/lib/salaries";
import { useExpenseOnly } from "@/components/role";

type ModalType = "payment" | "expense" | "client" | "salary" | "recurring" | null;

export function QuickAddFab() {
  const router = useRouter();
  const expenseOnly = useExpenseOnly();

  const [menuOpen, setMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [loading, setLoading] = useState(false);

  // Form prerequisite state
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [invoices, setInvoices] = useState<PaymentInvoiceOption[]>([]);
  const [projects, setProjects] = useState<PaymentProjectOption[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string; salary?: number }[]>([]);
  const [salaryPayments, setSalaryPayments] = useState<{ id?: string; employee_id: string; salary_month: string }[]>([]);

  const handleOpenAction = async (type: ModalType) => {
    setMenuOpen(false);
    setLoading(true);

    try {
      if (type === "payment") {
        const [c, inv] = await Promise.all([listClients(), listInvoices()]);
        setClients(c);
        setInvoices(
          inv.map((i) => ({
            id: i.id,
            invoice_number: i.invoice_number,
            client_id: i.client_id,
            balance: i.balance,
          })),
        );
        try {
          const prj = await listProjects();
          setProjects(
            prj.map((p) => ({
              id: p.id,
              name: p.name,
              client_id: p.client_id,
              balance: p.balance,
            })),
          );
        } catch {
          setProjects([]);
        }
      } else if (type === "salary") {
        const [emp, sal] = await Promise.all([listEmployees(), listSalaryPayments()]);
        setEmployees(emp);
        setSalaryPayments(sal);
      }
      setActiveModal(type);
    } catch {
      // open modal anyway so user can try or see errors
      setActiveModal(type);
    } finally {
      setLoading(false);
    }
  };

  const handleSaved = () => {
    setActiveModal(null);
    router.refresh();
    window.dispatchEvent(new CustomEvent("dc-finance:refetch"));
  };

  const actionItems = expenseOnly
    ? [
        {
          type: "expense" as const,
          label: "Record Expense",
          description: "Log a new business expense",
          icon: Receipt,
          color: "text-amber-500 bg-amber-500/10 dark:bg-amber-500/20",
        },
      ]
    : [
        {
          type: "payment" as const,
          label: "Record Payment",
          description: "Log money received from a client",
          icon: CreditCard,
          color: "text-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/20",
        },
        {
          type: "expense" as const,
          label: "Record Expense",
          description: "Log a business expense",
          icon: Receipt,
          color: "text-rose-500 bg-rose-500/10 dark:bg-rose-500/20",
        },
        {
          type: "client" as const,
          label: "Add Client",
          description: "Create a new client profile",
          icon: Users,
          color: "text-blue-500 bg-blue-500/10 dark:bg-blue-500/20",
        },
        {
          type: "salary" as const,
          label: "Pay Salary",
          description: "Record employee salary payment",
          icon: Wallet,
          color: "text-purple-500 bg-purple-500/10 dark:bg-purple-500/20",
        },
        {
          type: "recurring" as const,
          label: "Add Recurring",
          description: "Set up repeating expense item",
          icon: RefreshCw,
          color: "text-teal-500 bg-teal-500/10 dark:bg-teal-500/20",
        },
      ];

  return (
    <>
      {/* Backdrop overlay when speed-dial is open */}
      {menuOpen && (
        <div
          className="print-hide fixed inset-0 z-40 bg-background/80 backdrop-blur-xs transition-opacity md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Floating Speed Dial Container */}
      <div className="print-hide fixed bottom-5 left-5 z-50 flex flex-col items-start gap-2 md:hidden">
        {/* Speed Dial Menu Items */}
        {menuOpen && (
          <div className="flex flex-col gap-2 rounded-2xl border bg-card/95 p-2 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-5 duration-200">
            <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Quick Add Input
            </p>
            {actionItems.map(({ type, label, description, icon: Icon, color }) => (
              <button
                key={type}
                type="button"
                onClick={() => handleOpenAction(type)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-accent/80 active:scale-98"
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* FAB Trigger Button */}
        <Button
          onClick={() => setMenuOpen((prev) => !prev)}
          size="icon"
          disabled={loading}
          className="h-12 w-12 rounded-full shadow-lg transition-transform active:scale-95"
          aria-label={menuOpen ? "Close quick actions menu" : "Open quick actions menu"}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : menuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Plus className="h-6 w-6" />
          )}
        </Button>
      </div>

      {/* Controlled Form Modals */}
      {activeModal === "payment" && (
        <PaymentForm
          clients={clients}
          invoices={invoices}
          projects={projects}
          open={true}
          onOpenChange={(o) => !o && setActiveModal(null)}
          onSaved={handleSaved}
        />
      )}

      {activeModal === "expense" && (
        <ExpenseForm
          open={true}
          onOpenChange={(o) => !o && setActiveModal(null)}
          onSaved={handleSaved}
        />
      )}

      {activeModal === "client" && (
        <ClientForm
          open={true}
          onOpenChange={(o) => !o && setActiveModal(null)}
          onSaved={handleSaved}
        />
      )}

      {activeModal === "salary" && (
        <SalaryPaymentForm
          employees={employees}
          payments={salaryPayments}
          open={true}
          onOpenChange={(o) => !o && setActiveModal(null)}
          onSaved={handleSaved}
        />
      )}

      {activeModal === "recurring" && (
        <RecurringForm
          open={true}
          onOpenChange={(o) => !o && setActiveModal(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
