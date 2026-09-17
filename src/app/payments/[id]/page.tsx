"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Printer, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getPayment, type PaymentDetail } from "@/lib/payments";
import { numberToIndianWords } from "@/lib/invoices";
import { formatDate } from "@/lib/format";
import { useSettings } from "@/components/settings-provider";

const formatBillingMonth = (m: string) =>
  m ? new Date(`${m}-01`).toLocaleString("en-IN", { month: "short", year: "numeric" }) : "—";

export default function PaymentReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { formatCurrency, settings } = useSettings();
  const company = settings?.company_name || "Digicloudify Finance";
  const companyLogo = settings?.company_logo;
  const companyGstin = settings?.company_gstin;
  const companyState = settings?.company_state || "Telangana";
  const companyAddress = settings?.company_address;
  const companyPan = settings?.company_pan;

  const bankName = settings?.bank_name;
  const accountNumber = settings?.account_number;
  const ifscCode = settings?.ifsc_code;
  const upiId = settings?.upi_id;
  const bankBranch = settings?.bank_branch;
  const hasBankDetails = Boolean(bankName || accountNumber || ifscCode || upiId);

  useEffect(() => {
    (async () => {
      try {
        const data = await getPayment(id);
        setPayment(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load payment receipt");
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

  if (error || !payment) {
    return (
      <Card>
        <CardContent className="flex items-start gap-3 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Couldn’t load receipt</p>
            <p className="mt-1 text-muted-foreground">{error ?? "Receipt not found"}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const receiptNo = `REC-${payment.id.slice(0, 8).toUpperCase()}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Toolbar (not printed) */}
      <div className="print-hide flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/payments">
            <ArrowLeft className="h-4 w-4" />
            Back to payments
          </Link>
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Print / Save Receipt
        </Button>
      </div>

      {/* Receipt Document */}
      <div className="rounded-lg border bg-card p-8 print:border-0 print:p-0 print:shadow-none space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b pb-6">
          <div>
            {companyLogo && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={companyLogo} alt={company} className="h-12 w-auto max-w-[200px] object-contain mb-3" />
            )}
            <h1 className="text-2xl font-bold tracking-tight">{company}</h1>
            <p className="mt-0.5 text-sm font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              OFFICIAL PAYMENT RECEIPT
            </p>
            {companyAddress && <p className="mt-1 text-xs text-muted-foreground max-w-xs">{companyAddress}</p>}
            <div className="mt-2 text-xs space-y-0.5 text-muted-foreground">
              {companyGstin && <p><span className="font-semibold text-foreground">GSTIN:</span> {companyGstin}</p>}
              {companyPan && <p><span className="font-semibold text-foreground">PAN:</span> {companyPan}</p>}
              <p><span className="font-semibold text-foreground">State:</span> {companyState}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold font-mono">{receiptNo}</p>
            <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
              <CheckCircle2 className="h-3.5 w-3.5" />
              PAYMENT RECEIVED
            </div>
            <div className="mt-3 text-xs text-muted-foreground space-y-1">
              <p><span className="font-medium text-foreground">Receipt Date:</span> {formatDate(payment.payment_date)}</p>
              <p><span className="font-medium text-foreground">Billing Period:</span> {formatBillingMonth(payment.billing_month)}</p>
            </div>
          </div>
        </div>

        {/* Received From Details */}
        <div className="grid grid-cols-2 gap-4 text-sm bg-muted/20 rounded-md p-4 print:bg-gray-50 print:border">
          <div>
            <p className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">RECEIVED FROM</p>
            <p className="mt-1 font-bold text-base">{payment.clients?.name || "Client"}</p>
            {payment.clients?.company && <p className="font-medium text-muted-foreground">{payment.clients.company}</p>}
            {payment.clients?.address && (
              <p className="mt-1 text-xs text-muted-foreground max-w-xs whitespace-pre-wrap">{payment.clients.address}</p>
            )}
          </div>
          <div className="text-right space-y-1 text-xs">
            <p className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">TRANSACTION INFO</p>
            <p><span className="font-semibold text-foreground">Payment Method:</span> {payment.payment_method}</p>
            {payment.reference_number && (
              <p><span className="font-semibold text-foreground">Reference / UTR:</span> {payment.reference_number}</p>
            )}
            {payment.clients?.gstin && (
              <p className="mt-1"><span className="font-semibold text-foreground">Client GSTIN:</span> {payment.clients.gstin}</p>
            )}
          </div>
        </div>

        {/* Payment Line Item Table */}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
              <th className="py-2 px-2 font-semibold">Payment Description</th>
              <th className="py-2 px-2 text-center font-semibold">Period</th>
              <th className="py-2 px-2 text-center font-semibold">Payment Method</th>
              <th className="py-2 px-2 text-right font-semibold">Amount Received</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            <tr>
              <td className="py-3 px-2 font-medium">
                {payment.invoice ? (
                  <div>
                    <span>Payment for Invoice #{payment.invoice.invoice_number}</span>
                    <span className="block text-xs text-muted-foreground">
                      Invoice Total: {formatCurrency(payment.invoice.total)}
                    </span>
                  </div>
                ) : (
                  <span>Payment received for service retainer ({formatBillingMonth(payment.billing_month)})</span>
                )}
              </td>
              <td className="py-3 px-2 text-center font-mono text-xs">{formatBillingMonth(payment.billing_month)}</td>
              <td className="py-3 px-2 text-center text-xs font-medium">{payment.payment_method}</td>
              <td className="py-3 px-2 text-right tabular-nums font-bold text-base text-emerald-600 dark:text-emerald-400">
                {formatCurrency(payment.amount)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Financial Totals & Words */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-t pt-4">
          <div className="text-xs space-y-1.5 max-w-sm">
            <p className="font-semibold text-muted-foreground uppercase tracking-wider">AMOUNT IN WORDS</p>
            <p className="font-medium text-foreground italic bg-muted/40 p-2.5 rounded-md border print:bg-gray-50">
              {numberToIndianWords(payment.amount)}
            </p>
          </div>

          <div className="w-full sm:w-72 space-y-2 text-sm">
            <div className="flex justify-between border-t pt-2 text-lg font-bold">
              <span>Total Received:</span>
              <span className="tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(payment.amount)}</span>
            </div>
          </div>
        </div>

        {payment.notes && (
          <div className="border-t pt-4 text-xs">
            <p className="font-semibold uppercase tracking-wider text-muted-foreground">REMARKS / NOTES</p>
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground leading-relaxed">{payment.notes}</p>
          </div>
        )}

        {/* Bank & Authorized Signatory */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-6">
          {hasBankDetails ? (
            <div className="text-xs space-y-1 bg-muted/20 p-3.5 rounded-md border print:bg-gray-50">
              <p className="font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">COMPANY BANK DETAILS</p>
              {bankName && <p><span className="font-medium text-foreground">Bank:</span> {bankName}</p>}
              {accountNumber && <p><span className="font-medium text-foreground">Account No:</span> {accountNumber}</p>}
              {ifscCode && <p><span className="font-medium text-foreground">IFSC Code:</span> {ifscCode}</p>}
              {bankBranch && <p><span className="font-medium text-foreground">Branch:</span> {bankBranch}</p>}
              {upiId && <p><span className="font-medium text-foreground">UPI ID / VPA:</span> {upiId}</p>}
            </div>
          ) : (
            <div />
          )}

          <div className="flex flex-col items-end justify-between text-right text-xs pt-2">
            <p className="font-semibold text-foreground">For {company}</p>
            <div className="h-12" /> {/* Space for signature/stamp */}
            <p className="border-t border-muted-foreground/40 pt-1 font-medium text-muted-foreground w-40 text-center">
              Authorized Signatory
            </p>
          </div>
        </div>

        {/* Footer Disclaimer */}
        <div className="border-t pt-4 text-center text-[10px] text-muted-foreground">
          This is an official computer-generated payment receipt and requires no physical signature when transmitted electronically.
        </div>
      </div>
    </div>
  );
}
