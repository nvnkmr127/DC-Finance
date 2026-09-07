"use client";

import { useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Pencil, Trash2, Power, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Pencil as PencilIcon, Trash2 as Trash2Icon, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { BulkSalaryForm } from "@/components/bulk-salary-form";
import {
  listEmployees,
  listSalaryPayments,
  deleteEmployee,
  setEmployeeActive,
  deleteSalaryPayment,
  deleteSalaryPaymentsBulk,
  updateSalaryPaymentsBulk,
  netSalary,
  type Employee,
  type SalaryPayment,
} from "@/lib/salaries";
import { formatINR, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

// "2025-07" → "Jul 2025"
const formatSalaryMonth = (m: string) =>
  m ? new Date(`${m}-01`).toLocaleString("en-IN", { month: "short", year: "numeric" }) : "—";

export default function SalariesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [delEmp, setDelEmp] = useState<Employee | null>(null);
  const [editPay, setEditPay] = useState<SalaryPayment | null>(null);
  const [delPay, setDelPay] = useState<SalaryPayment | null>(null);

  // Bulk selection on the Salary Payments table.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkDelOpen, setBulkDelOpen] = useState(false);
  const [bulkMonth, setBulkMonth] = useState("");
  const [bulkDate, setBulkDate] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  const toggleRow = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const clearSelection = () => setSelected(new Set());

  async function refetch() {
    setLoading(true);
    setError(null);
    try {
      const [e, p] = await Promise.all([listEmployees(), listSalaryPayments()]);
      setEmployees(e);
      setPayments(p);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load salaries");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refetch();
  }, []);

  const [empSearch, setEmpSearch] = useState("");
  const [empStatus, setEmpStatus] = useState("all");

  const filteredEmployees = useMemo(() => {
    const q = empSearch.trim().toLowerCase();
    return employees.filter((e) => {
      const matchesSearch = !q || e.name.toLowerCase().includes(q) || e.designation.toLowerCase().includes(q);
      const matchesStatus = empStatus === "all" || e.status === empStatus;
      return matchesSearch && matchesStatus;
    });
  }, [employees, empSearch, empStatus]);

  const hasEmpFilters = empSearch !== "" || empStatus !== "all";
  function resetEmpFilters() {
    setEmpSearch("");
    setEmpStatus("all");
  }

  const [paySearch, setPaySearch] = useState("");
  const [payMonth, setPayMonth] = useState("");

  const filteredPayments = useMemo(() => {
    const q = paySearch.trim().toLowerCase();
    return payments.filter((p) => {
      const matchesSearch = !q || p.employees?.name.toLowerCase().includes(q) || (p.notes && p.notes.toLowerCase().includes(q));
      const matchesMonth = !payMonth || p.salary_month === payMonth; // filter by salary period, not pay date
      return matchesSearch && matchesMonth;
    });
  }, [payments, paySearch, payMonth]);

  const hasPayFilters = paySearch !== "" || payMonth !== "";
  function resetPayFilters() {
    setPaySearch("");
    setPayMonth("");
  }

  const allFilteredSelected =
    filteredPayments.length > 0 && filteredPayments.every((p) => selected.has(p.id));
  const toggleAll = () =>
    setSelected((prev) =>
      filteredPayments.length && filteredPayments.every((p) => prev.has(p.id))
        ? new Set()
        : new Set(filteredPayments.map((p) => p.id)),
    );

  async function applyBulkEdit() {
    const patch: { salary_month?: string; payment_date?: string } = {};
    if (bulkMonth) patch.salary_month = bulkMonth;
    if (bulkDate) patch.payment_date = bulkDate;
    if (Object.keys(patch).length === 0) {
      toast.error("Set a salary month or payment date to apply");
      return;
    }
    setBulkSaving(true);
    try {
      await updateSalaryPaymentsBulk([...selected], patch);
      toast.success(`Updated ${selected.size} payment${selected.size > 1 ? "s" : ""}`);
      setBulkEditOpen(false);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setBulkSaving(false);
    }
  }

  async function applyBulkDelete() {
    setBulkSaving(true);
    try {
      await deleteSalaryPaymentsBulk([...selected]);
      toast.success(`Deleted ${selected.size} payment${selected.size > 1 ? "s" : ""}`);
      setBulkDelOpen(false);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setBulkSaving(false);
    }
  }

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

    // Pending = active employees whose salary FOR this month hasn't been recorded
    // yet, keyed on salary_month (period), independent of when it's paid.
    const paidByEmployee = new Map<string, number>();
    for (const p of payments) {
      if (p.salary_month === monthPrefix) {
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative sm:max-w-xs sm:flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                  placeholder="Search employees…"
                  className="pl-9"
                />
              </div>
              <Select value={empStatus} onValueChange={setEmpStatus}>
                <SelectTrigger className="sm:w-44">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              {hasEmpFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetEmpFilters}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Reset
                </Button>
              )}
            </div>
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
                ) : filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-sm text-muted-foreground">
                      No employees found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map((e) => (
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative sm:max-w-xs sm:flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={paySearch}
                  onChange={(e) => setPaySearch(e.target.value)}
                  placeholder="Search payments…"
                  className="pl-9"
                />
              </div>
              <Input
                type="month"
                value={payMonth}
                onChange={(e) => setPayMonth(e.target.value)}
                className="sm:w-40"
                aria-label="Filter by month"
              />
              {hasPayFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetPayFilters}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Reset
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <BulkSalaryForm showTrigger employees={activeEmployees} payments={payments} onSaved={refetch} />
              <SalaryPaymentForm showTrigger employees={activeEmployees} payments={payments} onSaved={refetch} />
            </div>
          </div>
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-accent/40 px-3 py-2 text-sm">
              <span className="font-medium">{selected.size} selected</span>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setBulkMonth(""); setBulkDate(""); setBulkEditOpen(true); }}>
                  <PencilIcon className="h-4 w-4" /> Edit
                </Button>
                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setBulkDelOpen(true)}>
                  <Trash2Icon className="h-4 w-4" /> Delete
                </Button>
                <Button size="sm" variant="ghost" onClick={clearSelection}>
                  <X className="h-4 w-4" /> Clear
                </Button>
              </div>
            </div>
          )}
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allFilteredSelected}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Salary Month</TableHead>
                  <TableHead>Paid On</TableHead>
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
                    <TableCell colSpan={9} className="h-32 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filteredPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center text-sm text-muted-foreground">
                      No salary payments found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayments.map((p) => (
                    <TableRow key={p.id} data-state={selected.has(p.id) ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(p.id)}
                          onCheckedChange={() => toggleRow(p.id)}
                          aria-label={`Select ${p.employees?.name ?? "payment"}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{p.employees?.name ?? "Unknown"}</TableCell>
                      <TableCell className="font-medium">{formatSalaryMonth(p.salary_month)}</TableCell>
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
        payments={payments}
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

      {/* Bulk edit — apply salary month and/or payment date to selected rows */}
      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {selected.size} salary payment{selected.size === 1 ? "" : "s"}</DialogTitle>
            <DialogDescription>
              Only filled fields are applied to all selected rows. Leave a field blank to keep it unchanged.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="bulk_salary_month">Salary Month</Label>
              <Input id="bulk_salary_month" type="month" value={bulkMonth} onChange={(e) => setBulkMonth(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="bulk_pay_date">Payment Date</Label>
              <Input id="bulk_pay_date" type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkEditOpen(false)} disabled={bulkSaving}>Cancel</Button>
            <Button onClick={applyBulkEdit} disabled={bulkSaving}>
              {bulkSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Apply to {selected.size}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={bulkDelOpen} onOpenChange={(o) => !o && setBulkDelOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} salary payment{selected.size === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>This removes all selected records and can’t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={applyBulkDelete} disabled={bulkSaving} className="bg-destructive text-white hover:bg-destructive/90">
              Delete {selected.size}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
