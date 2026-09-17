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
  calculateGstBreakdown,
  numberToIndianWords,
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
  const companyLogo = settings?.company_logo;
  const companyGstin = settings?.company_gstin;
  const companyState = settings?.company_state || "Telangana";
  const companyAddress = settings?.company_address;
  const companyPan = settings?.company_pan;

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

  const rawItemsTotal = items.reduce((s, i) => s + (i.quantity * i.unit_price), 0);
  const isGst = invoice.is_gst_invoice ?? false;
  const isTaxInclusive = invoice.is_tax_inclusive ?? false;
  const gstRate = invoice.gst_rate ?? 18;
  const clientState = invoice.client_state || companyState;

  const gst = calculateGstBreakdown(rawItemsTotal, isGst, gstRate, isTaxInclusive, companyState, clientState);
  const grandTotal = isGst ? gst.grandTotal : (invoice.total || rawItemsTotal);

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
      <div className="rounded-lg border bg-card p-8 print:border-0 print:p-0 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b pb-6">
          <div>
            {companyLogo && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={companyLogo} alt={company} className="h-12 w-auto max-w-[200px] object-contain mb-3" />
            )}
            <h1 className="text-2xl font-bold tracking-tight">{company}</h1>
            <p className="mt-0.5 text-sm font-semibold uppercase tracking-wider text-primary">
              {isGst ? "GST TAX INVOICE" : "INVOICE"}
            </p>
            {companyAddress && <p className="mt-1 text-xs text-muted-foreground max-w-xs">{companyAddress}</p>}
            <div className="mt-2 text-xs space-y-0.5 text-muted-foreground">
              {companyGstin && <p><span className="font-semibold text-foreground">GSTIN:</span> {companyGstin}</p>}
              {companyPan && <p><span className="font-semibold text-foreground">PAN:</span> {companyPan}</p>}
              <p><span className="font-semibold text-foreground">State:</span> {companyState}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold">{invoice.invoice_number}</p>
            <div className="mt-1">
              <StatusBadge status={invoice.display_status} />
            </div>
            <div className="mt-3 text-xs text-muted-foreground space-y-1">
              <p><span className="font-medium text-foreground">Issue Date:</span> {formatDate(invoice.issue_date)}</p>
              <p><span className="font-medium text-foreground">Due Date:</span> {formatDate(invoice.due_date)}</p>
            </div>
          </div>
        </div>

        {/* Bill To Details */}
        <div className="grid grid-cols-2 gap-4 text-sm bg-muted/20 rounded-md p-4">
          <div>
            <p className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">BILLED TO</p>
            <p className="mt-1 font-bold text-base">{invoice.client_name}</p>
            <p className="font-medium text-muted-foreground">{invoice.client_company}</p>
            {invoice.client_address && (
              <p className="mt-1 text-xs text-muted-foreground max-w-xs whitespace-pre-wrap">{invoice.client_address}</p>
            )}
          </div>
          <div className="text-right space-y-1 text-xs">
            <p className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">PLACE OF SUPPLY</p>
            <p className="font-semibold text-sm">{clientState}</p>
            {invoice.client_gstin && (
              <p className="mt-1"><span className="font-semibold text-foreground">Client GSTIN:</span> {invoice.client_gstin}</p>
            )}
            {invoice.hsn_sac && (
              <p><span className="font-semibold text-foreground">HSN/SAC:</span> {invoice.hsn_sac}</p>
            )}
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
              <th className="py-2 px-2 font-semibold">Item Description</th>
              {isGst && <th className="py-2 px-2 text-center font-semibold">HSN/SAC</th>}
              <th className="py-2 px-2 text-right font-semibold">Qty</th>
              <th className="py-2 px-2 text-right font-semibold">Rate</th>
              <th className="py-2 px-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((it) => (
              <tr key={it.id}>
                <td className="py-3 px-2 font-medium">{it.description}</td>
                {isGst && <td className="py-3 px-2 text-center font-mono text-xs">{invoice.hsn_sac || "998314"}</td>}
                <td className="py-3 px-2 text-right tabular-nums">{it.quantity}</td>
                <td className="py-3 px-2 text-right tabular-nums">{formatCurrency(it.unit_price)}</td>
                <td className="py-3 px-2 text-right tabular-nums font-semibold">{formatCurrency(it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Financial & Tax Totals */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-t pt-4">
          <div className="text-xs space-y-1.5 max-w-sm">
            <p className="font-semibold text-muted-foreground uppercase tracking-wider">AMOUNT IN WORDS</p>
            <p className="font-medium text-foreground italic bg-muted/40 p-2.5 rounded-md border">
              {numberToIndianWords(grandTotal)}
            </p>
          </div>

          <div className="w-full sm:w-72 space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal (Taxable Value):</span>
              <span className="tabular-nums font-semibold text-foreground">{formatCurrency(gst.subtotal)}</span>
            </div>

            {isGst && gst.taxType === "cgst_sgst" && (
              <>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>CGST ({gst.cgstRate}%):</span>
                  <span className="tabular-nums">{formatCurrency(gst.cgstAmount)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>SGST ({gst.sgstRate}%):</span>
                  <span className="tabular-nums">{formatCurrency(gst.sgstAmount)}</span>
                </div>
              </>
            )}

            {isGst && gst.taxType === "igst" && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>IGST ({gst.igstRate}%):</span>
                <span className="tabular-nums">{formatCurrency(gst.igstAmount)}</span>
              </div>
            )}

            <div className="flex justify-between border-t pt-2 text-base font-bold">
              <span>Grand Total:</span>
              <span className="tabular-nums text-primary">{formatCurrency(grandTotal)}</span>
            </div>

            <div className="flex justify-between text-xs text-emerald-600 font-medium">
              <span>Amount Paid:</span>
              <span className="tabular-nums">{formatCurrency(invoice.paid)}</span>
            </div>

            <div className="flex justify-between text-sm font-bold border-t pt-1">
              <span>Balance Due:</span>
              <span className="tabular-nums">{formatCurrency(grandTotal - invoice.paid)}</span>
            </div>
          </div>
        </div>

        {invoice.notes && (
          <div className="border-t pt-4 text-xs">
            <p className="font-semibold uppercase tracking-wider text-muted-foreground">TERMS & NOTES</p>
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground leading-relaxed">{invoice.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
