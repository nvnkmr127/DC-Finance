"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Mail, Phone, Briefcase, History, TrendingUp, TrendingDown, Pencil, FileText } from "lucide-react";
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
import { ClientForm } from "@/components/client-form";
import { ContractAddendumDialog } from "@/components/contract-addendum-dialog";
import {
  getClientSummary,
  getClientPayments,
  getClientPricingHistory,
  billingCycleSuffix,
  BILLING_CYCLE_LABEL,
  type ClientSummary,
  type Payment,
  type ClientPricingRevision,
} from "@/lib/clients";
import { formatINR, formatDate } from "@/lib/format";

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<ClientSummary | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [pricingHistory, setPricingHistory] = useState<ClientPricingRevision[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedRevision, setSelectedRevision] = useState<ClientPricingRevision | null>(null);
  const [addendumOpen, setAddendumOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [c, p, h] = await Promise.all([
        getClientSummary(id),
        getClientPayments(id),
        getClientPricingHistory(id),
      ]);
      setClient(c);
      setPayments(p);
      setPricingHistory(h);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load client");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
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
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={client.status} />
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit Client
            </Button>
          </div>
        }
      />

      <ClientForm
        client={client}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={loadData}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left column: Client information + Pricing revision history */}
        <div className="space-y-4 lg:col-span-1">
          <Card>
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
                <span className="text-muted-foreground">
                  {client.billing_cycle === "commission"
                    ? "Billing"
                    : client.billing_cycle === "quarterly"
                      ? "Amount per Quarter"
                      : "Current Monthly Value"}
                </span>
                <span className="font-semibold tabular-nums text-foreground">
                  {client.billing_cycle === "commission"
                    ? "Commission"
                    : `${formatINR(client.monthly_value)}${billingCycleSuffix(client.billing_cycle)}`}
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

          {/* Pricing & Contract Revision History */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold text-foreground text-sm">
                  <History className="h-4 w-4 text-primary" />
                  Pricing History & Auditing
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {pricingHistory.length} {pricingHistory.length === 1 ? "log" : "logs"}
                </span>
              </div>
              <CardDescription>
                Audited contract revisions and price adjustments.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0">
              {pricingHistory.length === 0 ? (
                <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-foreground">Baseline Contract</div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => {
                        setSelectedRevision({
                          id: "base",
                          changed_at: client.created_at,
                          actor: "Admin",
                          action: "CREATED",
                          old_price: null,
                          new_price: client.monthly_value,
                          old_service: null,
                          new_service: client.service,
                          diff: 0,
                          percentage_change: null,
                        });
                        setAddendumOpen(true);
                      }}
                    >
                      <FileText className="mr-1 h-3 w-3 text-primary" />
                      Contract PDF
                    </Button>
                  </div>
                  <div className="mt-1">
                    {client.billing_cycle === "commission"
                      ? `Commission-based for ${client.service}`
                      : `Rate: ${formatINR(client.monthly_value)}${billingCycleSuffix(client.billing_cycle)} (${BILLING_CYCLE_LABEL[client.billing_cycle]}) for ${client.service}`}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground/80">
                    Future contract price updates will be logged here with timestamps and audit trail.
                  </div>
                </div>
              ) : (
                <div className="relative space-y-3 pl-3 before:absolute before:bottom-1 before:left-1 before:top-1 before:w-[2px] before:bg-border">
                  {pricingHistory.map((rev) => {
                    const isIncrease = rev.diff > 0;
                    const isDecrease = rev.diff < 0;

                    return (
                      <div key={rev.id} className="relative pl-3 text-xs">
                        <span className="absolute -left-[15px] top-1 h-2 w-2 rounded-full border-2 border-background bg-primary" />
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">
                            {formatINR(rev.new_price)}
                            <span className="text-[10px] font-normal text-muted-foreground">/mo</span>
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(rev.changed_at).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>

                        {rev.old_price !== null && (
                          <div className="mt-0.5 flex items-center gap-1 text-[11px]">
                            <span className="text-muted-foreground line-through">
                              {formatINR(rev.old_price)}
                            </span>
                            <span>&rarr;</span>
                            <span
                              className={`flex items-center font-medium ${
                                isIncrease
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : isDecrease
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {isIncrease ? <TrendingUp className="mr-0.5 h-3 w-3" /> : null}
                              {isDecrease ? <TrendingDown className="mr-0.5 h-3 w-3" /> : null}
                              {isIncrease ? "+" : ""}
                              {formatINR(rev.diff)}
                              {rev.percentage_change !== null
                                ? ` (${isIncrease ? "+" : ""}${rev.percentage_change}%)`
                                : ""}
                            </span>
                          </div>
                        )}

                        {rev.new_service && (
                          <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {rev.old_service && rev.old_service !== rev.new_service
                              ? `${rev.old_service} → ${rev.new_service}`
                              : rev.new_service}
                          </div>
                        )}

                        <div className="mt-1 flex items-center justify-between">
                          <div className="text-[10px] text-muted-foreground/70">
                            {rev.action === "CREATED" ? "Initial contract" : "Revised"} by {rev.actor || "Admin"}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-[10px] text-primary hover:text-primary/80"
                            onClick={() => {
                              setSelectedRevision(rev);
                              setAddendumOpen(true);
                            }}
                          >
                            <FileText className="mr-1 h-3 w-3" />
                            Addendum PDF
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <ContractAddendumDialog
          open={addendumOpen}
          onOpenChange={setAddendumOpen}
          client={client}
          revision={selectedRevision}
        />

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
