"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  getClientSummary,
  getClientPricingHistory,
  type ClientSummary,
  type ClientPricingRevision,
} from "@/lib/clients";
import { formatDate } from "@/lib/format";
import { useSettings } from "@/components/settings-provider";

export default function ContractAddendumPage() {
  const { id, revId } = useParams<{ id: string; revId: string }>();
  const [client, setClient] = useState<ClientSummary | null>(null);
  const [revision, setRevision] = useState<ClientPricingRevision | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { formatCurrency, settings } = useSettings();
  const companyName = settings?.company_name || "Digicloudify Finance";

  useEffect(() => {
    (async () => {
      try {
        const [c, history] = await Promise.all([
          getClientSummary(id),
          getClientPricingHistory(id),
        ]);
        setClient(c);
        const match = history.find((r) => String(r.id) === revId) || history[0] || null;
        setRevision(match);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load contract addendum");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, revId]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !client) {
    return (
      <Card>
        <CardContent className="flex items-start gap-3 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Couldn&rsquo;t load contract addendum</p>
            <p className="mt-1 text-muted-foreground">{error ?? "Client not found"}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const effectiveDate = revision
    ? new Date(revision.changed_at).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : formatDate(client.created_at);

  const isIncrease = revision ? revision.diff > 0 : false;
  const isDecrease = revision ? revision.diff < 0 : false;

  const addendumNumber = `ADD-${client.name
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 4)
    .toUpperCase()}-${revision ? String(revision.id).slice(-4).toUpperCase() : "BASE"}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Top action toolbar (hidden in print) */}
      <div className="print-hide flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/clients/${id}`}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to Client
          </Link>
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="mr-1.5 h-4 w-4" />
          Print / Save as PDF
        </Button>
      </div>

      {/* Contract Addendum Printable Document */}
      <div className="rounded-lg border bg-card p-8 sm:p-12 text-foreground print:border-0 print:p-0">
        {/* Header */}
        <div className="flex items-start justify-between border-b pb-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">{companyName}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Commercial Contracts & Billing Administration</p>
          </div>
          <div className="text-right">
            <span className="inline-block rounded border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              Contract Addendum
            </span>
            <p className="mt-1.5 text-xs font-mono font-medium text-foreground">{addendumNumber}</p>
            <p className="text-[11px] text-muted-foreground">Date: {effectiveDate}</p>
          </div>
        </div>

        {/* Title */}
        <div className="mt-6 text-center">
          <h2 className="text-base font-bold uppercase tracking-wider text-foreground">
            Addendum to Service Agreement
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Notice of Contract Pricing & Scope Revision
          </p>
        </div>

        {/* Parties */}
        <div className="mt-6 grid grid-cols-2 gap-6 rounded-md border bg-muted/20 p-4 text-xs">
          <div>
            <p className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
              Service Provider
            </p>
            <p className="mt-1 font-bold text-foreground text-sm">{companyName}</p>
            <p className="text-muted-foreground mt-0.5">Author/Auditor: {revision?.actor || "Authorized Admin"}</p>
          </div>
          <div>
            <p className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
              Client / Counterparty
            </p>
            <p className="mt-1 font-bold text-foreground text-sm">{client.name}</p>
            <p className="text-muted-foreground">{client.company}</p>
            <p className="text-muted-foreground">{client.email} | {client.phone}</p>
          </div>
        </div>

        {/* Recitals */}
        <div className="mt-5 space-y-2 text-xs leading-relaxed text-muted-foreground">
          <p>
            This Contract Addendum (&ldquo;Addendum&rdquo;) is entered into and effective as of{" "}
            <strong className="text-foreground">{effectiveDate}</strong>, by and between{" "}
            <strong className="text-foreground">{companyName}</strong> and{" "}
            <strong className="text-foreground">{client.name}</strong> ({client.company}).
          </p>
          <p>
            WHEREAS, the parties entered into an ongoing service agreement for professional services; and
            WHEREAS, the parties have reviewed and agreed upon revised commercial terms as set forth in the amendment schedule below.
          </p>
        </div>

        {/* Revision Diff Table */}
        <div className="mt-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground mb-2">
            Schedule of Revisions & Price Comparison
          </h3>
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/60 border-b text-[11px] font-semibold text-muted-foreground">
                <tr>
                  <th className="p-2.5">Parameter</th>
                  <th className="p-2.5">Previous Terms</th>
                  <th className="p-2.5">Amended Terms</th>
                  <th className="p-2.5 text-right">Variance / Adjustment</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs">
                <tr>
                  <td className="p-2.5 font-medium text-foreground">Service Designation</td>
                  <td className="p-2.5 text-muted-foreground">
                    {revision?.old_service || client.service || "Standard Services"}
                  </td>
                  <td className="p-2.5 font-medium text-foreground">
                    {revision?.new_service || client.service}
                  </td>
                  <td className="p-2.5 text-right text-muted-foreground">
                    {revision?.old_service && revision.old_service !== revision.new_service
                      ? "Scope Updated"
                      : "Unchanged"}
                  </td>
                </tr>
                <tr className="bg-muted/10">
                  <td className="p-2.5 font-medium text-foreground">Monthly Fee (Retainer)</td>
                  <td className="p-2.5 tabular-nums text-muted-foreground">
                    {revision && revision.old_price !== null ? formatCurrency(revision.old_price) : "—"}
                  </td>
                  <td className="p-2.5 font-bold tabular-nums text-foreground">
                    {revision ? formatCurrency(revision.new_price) : formatCurrency(client.monthly_value)}
                  </td>
                  <td className="p-2.5 text-right font-bold tabular-nums">
                    {revision && revision.old_price !== null ? (
                      <span
                        className={
                          isIncrease
                            ? "text-emerald-600 dark:text-emerald-400"
                            : isDecrease
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-muted-foreground"
                        }
                      >
                        {isIncrease ? "+" : ""}
                        {formatCurrency(revision.diff)}
                        {revision.percentage_change !== null &&
                          ` (${isIncrease ? "+" : ""}${revision.percentage_change}%)`}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Initial Baseline</span>
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="p-2.5 font-medium text-foreground">Effective Date</td>
                  <td className="p-2.5 text-muted-foreground">{formatDate(client.created_at)}</td>
                  <td className="p-2.5 font-medium text-foreground">{effectiveDate}</td>
                  <td className="p-2.5 text-right text-muted-foreground">Immediate Effect</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Legal affirmation */}
        <div className="mt-5 rounded-md border border-border/80 bg-muted/10 p-3 text-[11px] text-muted-foreground leading-relaxed">
          <p className="font-semibold text-foreground mb-0.5">Affirmation of Contract Terms:</p>
          Except as expressly modified herein, all covenants, agreements, and terms of the original agreement shall continue in full force and effect. This document constitutes a formal audited addendum to the commercial record.
        </div>

        {/* Signatures */}
        <div className="mt-10 grid grid-cols-2 gap-12 pt-6 border-t">
          <div>
            <div className="h-12 border-b border-dashed border-muted-foreground/50"></div>
            <p className="mt-2 text-xs font-bold text-foreground">For: {companyName}</p>
            <p className="text-[11px] text-muted-foreground">Authorized Signature</p>
            <p className="text-[11px] text-muted-foreground mt-1">Date: ________________________</p>
          </div>
          <div>
            <div className="h-12 border-b border-dashed border-muted-foreground/50"></div>
            <p className="mt-2 text-xs font-bold text-foreground">For: {client.company}</p>
            <p className="text-[11px] text-muted-foreground">Client Representative ({client.name})</p>
            <p className="text-[11px] text-muted-foreground mt-1">Date: ________________________</p>
          </div>
        </div>
      </div>
    </div>
  );
}
