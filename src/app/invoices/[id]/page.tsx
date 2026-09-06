"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Printer, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import {
  getInvoice,
  getInvoiceItems,
  type InvoiceSummary,
  type InvoiceItem,
} from "@/lib/invoices";
import { formatDate } from "@/lib/format";
import { useSettings } from "@/components/settings-provider";

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<InvoiceSummary | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { formatCurrency, settings } = useSettings();
  const company = settings?.company_name || "Digicloudify Finance";

  useEffect(() => {
    (async () => {
      try {
        const [inv, its] = await Promise.all([getInvoice(id), getInvoiceItems(id)]);
        setInvoice(inv);
        setItems(its);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load invoice");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <Card>
        <CardContent className="flex items-start gap-3 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Couldn’t load invoice</p>
            <p className="mt-1 text-muted-foreground">{error ?? "Not found"}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Toolbar (not printed) */}
      <div className="print-hide flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/invoices">
            <ArrowLeft className="h-4 w-4" />
            Back to invoices
          </Link>
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Print / Save as PDF
        </Button>
      </div>

      {/* Invoice document */}
      <div className="rounded-lg border bg-card p-8 print:border-0 print:p-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">{company}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Tax Invoice</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold">{invoice.invoice_number}</p>
            <div className="mt-1">
              <StatusBadge status={invoice.display_status} />
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Bill To</p>
            <p className="mt-1 font-medium">{invoice.client_name}</p>
            <p className="text-muted-foreground">{invoice.client_company}</p>
          </div>
          <div className="text-right">
            <p>
              <span className="text-muted-foreground">Issue date: </span>
              {formatDate(invoice.issue_date)}
            </p>
            <p>
              <span className="text-muted-foreground">Due date: </span>
              {formatDate(invoice.due_date)}
            </p>
          </div>
        </div>

        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 font-medium">Description</th>
              <th className="pb-2 text-right font-medium">Qty</th>
              <th className="pb-2 text-right font-medium">Unit Price</th>
              <th className="pb-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-b">
                <td className="py-2">{it.description}</td>
                <td className="py-2 text-right tabular-nums">{it.quantity}</td>
                <td className="py-2 text-right tabular-nums">{formatCurrency(it.unit_price)}</td>
                <td className="py-2 text-right tabular-nums">{formatCurrency(it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <div className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold tabular-nums">{formatCurrency(invoice.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Paid</span>
              <span className="tabular-nums text-emerald-600">{formatCurrency(invoice.paid)}</span>
            </div>
            <div className="flex justify-between border-t pt-1 text-base font-bold">
              <span>Balance Due</span>
              <span className="tabular-nums">{formatCurrency(invoice.balance)}</span>
            </div>
          </div>
        </div>

        {invoice.notes && (
          <div className="mt-8 border-t pt-4 text-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{invoice.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
