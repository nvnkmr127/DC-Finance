"use client";

import { useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Pencil, Trash2, Power, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/status-badge";
import { EmployeeForm } from "@/components/employee-form";
import { SalaryPaymentForm } from "@/components/salary-payment-form";
import {
  listEmployees,
  listSalaryPayments,
  deleteEmployee,
  setEmployeeActive,
  deleteSalaryPayment,
  netSalary,
  type Employee,
  type SalaryPayment,
} from "@/lib/salaries";
import { formatINR, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function SalariesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [delEmp, setDelEmp] = useState<Employee | null>(null);
  const [editPay, setEditPay] = useState<SalaryPayment | null>(null);
  const [delPay, setDelPay] = useState<SalaryPayment | null>(null);

  async function refetch() {
    setLoading(true);
    setError(null);
    try {
      const [e, p] = await Promise.all([listEmployees(), listSalaryPayments()]);
      setEmployees(e);
      setPayments(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load salaries");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refetch();
  }, []);

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status === "active"),
    [employees],
  );

  const summary = useMemo(() => {
    const monthPrefix = new Date().toISOString().slice(0, 7);
    const yearPrefix = new Date().toISOString().slice(0, 4);
    const paidThisMonth = payments
      .filter((p) => p.payment_date.startsWith(monthPrefix))
      .reduce((s, p) => s + netSalary(p), 0);
    const paidThisYear = payments
      .filter((p) => p.payment_date.startsWith(yearPrefix))
      .reduce((s, p) => s + netSalary(p), 0);

    // Pending = active employees' monthly salary not yet paid (net) this month.
    const paidByEmployee = new Map<string, number>();
    for (const p of payments) {
      if (p.payment_date.startsWith(monthPrefix)) {
        paidByEmployee.set(p.employee_id, (paidByEmployee.get(p.employee_id) ?? 0) + netSalary(p));
      }
    }
    const pending = activeEmployees.reduce(
      (s, e) => s + Math.max(e.salary - (paidByEmployee.get(e.id) ?? 0), 0),
      0,
    );

    return { paidThisMonth, paidThisYear, pending };
  }, [payments, activeEmployees]);

  async function toggleActive(e: Employee) {
    try {
      await setEmployeeActive(e.id, e.status !== "active");
      toast.success(e.status === "active" ? "Deactivated" : "Activated");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  }

  async function confirmDeleteEmp() {
    if (!delEmp) return;
    try {
      await deleteEmployee(delEmp.id);
      toast.success("Employee deleted");
      setDelEmp(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
      setDelEmp(null);
    }
  }

  async function confirmDeletePay() {
    if (!delPay) return;
    try {
      await deleteSalaryPayment(delPay.id);
      toast.success("Salary payment deleted");
      setDelPay(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
      setDelPay(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Salaries" description="Employees & payroll" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Paid This Month" value={formatINR(summary.paidThisMonth)} tone="positive" />
        <MetricCard label="Paid This Year" value={formatINR(summary.paidThisYear)} />
        <MetricCard label="Pending Salary" value={formatINR(summary.pending)} tone="warning" sub="Active employees, this month" />
      </div>

      {error && (
        <Card>
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Couldn’t load salaries</p>
              <p className="mt-1 text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="employees" className="space-y-4">
        <TabsList>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="payments">Salary Payments</TabsTrigger>
        </TabsList>

        {/* Employees */}
        <TabsContent value="employees" className="space-y-4">
          <div className="flex justify-end">
            <EmployeeForm showTrigger onSaved={refetch} />
          </div>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead className="text-right">Monthly Salary</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : employees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-sm text-muted-foreground">
                      No employees yet
                    </TableCell>
                  </TableRow>
                ) : (
                  employees.map((e) => (
                    <TableRow key={e.id} className={cn(e.status !== "active" && "opacity-60")}>
                      <TableCell className="font-medium">{e.name}</TableCell>
                      <TableCell className="text-muted-foreground">{e.designation}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatINR(e.salary)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={e.status} />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => setEditEmp(e)}>
                              <Pencil className="h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => toggleActive(e)}>
                              <Power className="h-4 w-4" />
                              {e.status === "active" ? "Deactivate" : "Activate"}
                            </DropdownMenuItem>
                            <DropdownMenuItem variant="destructive" onSelect={() => setDelEmp(e)}>
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Salary payments */}
        <TabsContent value="payments" className="space-y-4">
          <div className="flex justify-end">
            <SalaryPaymentForm showTrigger employees={activeEmployees} onSaved={refetch} />
          </div>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Bonus</TableHead>
                  <TableHead className="text-right">Deduction</TableHead>
                  <TableHead className="text-right">Net Salary</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-sm text-muted-foreground">
                      No salary payments yet
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.employees?.name ?? "Unknown"}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(p.payment_date)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(p.amount)}</TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600">
                        {p.bonus ? `+${formatINR(p.bonus)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-red-600">
                        {p.deduction ? `−${formatINR(p.deduction)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatINR(netSalary(p))}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => setEditPay(p)}>
                              <Pencil className="h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem variant="destructive" onSelect={() => setDelPay(p)}>
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit dialogs (controlled) */}
      <EmployeeForm
        employee={editEmp ?? undefined}
        open={editEmp !== null}
        onOpenChange={(o) => !o && setEditEmp(null)}
        onSaved={refetch}
      />
      <SalaryPaymentForm
        employees={activeEmployees}
        payment={editPay ?? undefined}
        open={editPay !== null}
        onOpenChange={(o) => !o && setEditPay(null)}
        onSaved={refetch}
      />

      {/* Delete confirms */}
      <AlertDialog open={delEmp !== null} onOpenChange={(o) => !o && setDelEmp(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {delEmp?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the employee and their salary payment records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteEmp} className="bg-destructive text-white hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={delPay !== null} onOpenChange={(o) => !o && setDelPay(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this salary payment?</AlertDialogTitle>
            <AlertDialogDescription>
              {delPay &&
                `${formatINR(netSalary(delPay))} net to ${delPay.employees?.name ?? "employee"} on ${formatDate(delPay.payment_date)}. This can't be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeletePay} className="bg-destructive text-white hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
