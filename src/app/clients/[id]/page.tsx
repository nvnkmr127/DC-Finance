"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Mail, Phone, Briefcase } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RevenueBarChart } from "@/components/charts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { MetricCard } from "@/components/metric-card";
import {
  getClientSummary,
  getClientPayments,
  type ClientSummary,
  type Payment,
} from "@/lib/clients";
import { formatINR, formatDate } from "@/lib/format";

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<ClientSummary | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [c, p] = await Promise.all([
          getClientSummary(id),
          getClientPayments(id),
        ]);
        setClient(c);
        setPayments(p);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load client");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Revenue per month for the trailing 6 months, from this client's payments.
  const monthlyRevenue = useMemo(() => {
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
      const bucket = months.find((m) => m.key === p.payment_date.slice(0, 7));
      if (bucket) bucket.amount += p.amount;
    }
    return months;
  }, [payments]);

  const back = (
    <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
      <Link href="/clients">
        <ArrowLeft className="h-4 w-4" />
        Back to clients
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

  if (error || !client) {
    return (
      <div className="space-y-6">
        {back}
        <p className="text-sm text-destructive">{error ?? "Client not found"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {back}
      <PageHeader
        title={client.name}
        description={client.company}
        action={<StatusBadge status={client.status} />}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Client information */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Client Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a href={`mailto:${client.email}`} className="hover:underline">
                {client.email}
              </a>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{client.phone}</span>
            </div>
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <span>{client.service}</span>
            </div>
            <div className="flex justify-between border-t pt-3">
              <span className="text-muted-foreground">Monthly Value</span>
              <span className="font-medium tabular-nums">
                {formatINR(client.monthly_value)}
              </span>
            </div>
            {client.notes && (
              <div className="border-t pt-3">
                <p className="mb-1 text-muted-foreground">Notes</p>
                <p className="whitespace-pre-wrap">{client.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Totals + payment history */}
        <div className="space-y-4 lg:col-span-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MetricCard
              label="Total Revenue"
              value={formatINR(client.total_received)}
              tone="positive"
              sub="Paid to date"
            />
            <MetricCard
              label="Outstanding"
              value={formatINR(client.outstanding)}
              tone="warning"
            />
            <MetricCard label="Total Payments" value={String(client.payment_count)} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Revenue</CardTitle>
              <CardDescription>Last 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              <RevenueBarChart data={monthlyRevenue} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>Recent transactions</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-sm text-muted-foreground">
                        No payments recorded
                      </TableCell>
                    </TableRow>
                  ) : (
                    payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-muted-foreground">
                          {formatDate(p.payment_date)}
                        </TableCell>
                        <TableCell>{p.payment_method}</TableCell>
                        <TableCell className="max-w-[220px] truncate text-muted-foreground">
                          {p.notes || "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatINR(p.amount)}
                        </TableCell>
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
