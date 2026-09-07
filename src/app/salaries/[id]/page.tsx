"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Briefcase, CalendarDays, Pencil } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RevenueBarChart } from "@/components/charts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { MetricCard } from "@/components/metric-card";
import { EmployeeForm } from "@/components/employee-form";
import { SalaryPaymentForm } from "@/components/salary-payment-form";
import {
  getEmployee,
  getEmployeeSalaryPayments,
  netSalary,
  type Employee,
  type SalaryPayment,
} from "@/lib/salaries";
import { financialYear, formatINR, formatDate } from "@/lib/format";
import { useSettings } from "@/components/settings-provider";

const formatSalaryMonth = (m: string) =>
  m ? new Date(`${m}-01`).toLocaleString("en-IN", { month: "short", year: "numeric" }) : "—";

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { settings } = useSettings();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [e, p] = await Promise.all([getEmployee(id), getEmployeeSalaryPayments(id)]);
      setEmployee(e);
      setPayments(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load employee");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const stats = useMemo(() => {
    const month = new Date().toISOString().slice(0, 7);
    const fy = financialYear(settings?.financial_year_start || "04-01");
    const inFyMonth = (m: string) => `${m}-01` >= fy.start && `${m}-01` < fy.end;
    const totalPaid = payments.reduce((s, p) => s + netSalary(p), 0);
    const paidFy = payments.filter((p) => inFyMonth(p.salary_month)).reduce((s, p) => s + netSalary(p), 0);
    const paidThisMonth = payments.filter((p) => p.salary_month === month).reduce((s, p) => s + netSalary(p), 0);
    const pending = Math.max((employee?.salary ?? 0) - paidThisMonth, 0);
    return { totalPaid, paidFy, pending, count: payments.length, fyLabel: fy.label };
  }, [payments, employee, settings]);

  // Net salary per salary month, trailing 6 months.
  const monthly = useMemo(() => {
    const now = new Date();
    const months: { key: string; month: string; amount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        month: d.toLocaleString("en-IN", { month: "short", year: "2-digit" }),
        amount: 0,
      });
    }
    for (const p of payments) {
      const bucket = months.find((m) => m.key === p.salary_month);
      if (bucket) bucket.amount += netSalary(p);
    }
    return months;
  }, [payments]);

  const back = (
    <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
      <Link href="/salaries">
        <ArrowLeft className="h-4 w-4" />
        Back to salaries
      </Link>
    </Button>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {back}
        <Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="space-y-6">
        {back}
        <p className="text-sm text-destructive">{error ?? "Employee not found"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {back}
      <PageHeader
        title={employee.name}
        description={employee.designation}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={employee.status} />
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
            <SalaryPaymentForm
              showTrigger
              employees={[{ id: employee.id, name: employee.name, salary: employee.salary }]}
              payments={payments}
              onSaved={loadData}
            />
          </div>
        }
      />

      <EmployeeForm employee={employee} open={editOpen} onOpenChange={setEditOpen} onSaved={loadData} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Employee Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span>{employee.designation}</span>
              </div>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span>Joined {formatDate(employee.joining_date)}</span>
              </div>
              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-muted-foreground">Monthly Salary</span>
                <span className="font-semibold tabular-nums text-foreground">{formatINR(employee.salary)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MetricCard label={`Paid ${stats.fyLabel}`} value={formatINR(stats.paidFy)} tone="positive" />
            <MetricCard label="Total Paid" value={formatINR(stats.totalPaid)} sub="All time" />
            <MetricCard label="Pending" value={formatINR(stats.pending)} tone="warning" sub="This month" />
            <MetricCard label="Payments" value={String(stats.count)} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Net Salary by Month</CardTitle>
              <CardDescription>Last 6 salary months</CardDescription>
            </CardHeader>
            <CardContent>
              <RevenueBarChart data={monthly} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Salary History</CardTitle>
              <CardDescription>All recorded payments</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Salary Month</TableHead>
                    <TableHead>Paid On</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Bonus</TableHead>
                    <TableHead className="text-right">Deduction</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                        No salary payments recorded
                      </TableCell>
                    </TableRow>
                  ) : (
                    payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{formatSalaryMonth(p.salary_month)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(p.payment_date)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatINR(p.amount)}</TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-600">{p.bonus ? `+${formatINR(p.bonus)}` : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums text-red-600">{p.deduction ? `−${formatINR(p.deduction)}` : "—"}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{formatINR(netSalary(p))}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
