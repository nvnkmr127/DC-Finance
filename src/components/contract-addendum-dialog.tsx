"use client";

import React from "react";
import { Printer, FileText, Download, CheckCircle2, TrendingUp, TrendingDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { type ClientSummary, type ClientPricingRevision } from "@/lib/clients";
import { useSettings } from "@/components/settings-provider";
import { formatDate } from "@/lib/format";

type ContractAddendumDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: ClientSummary;
  revision: ClientPricingRevision | null;
};

export function ContractAddendumDialog({
  open,
  onOpenChange,
  client,
  revision,
}: ContractAddendumDialogProps) {
  const { formatCurrency, settings } = useSettings();
  const companyName = settings?.company_name || "Digicloudify Finance";

  if (!revision) return null;

  const handlePrint = () => {
    window.print();
  };

  const isIncrease = revision.diff > 0;
  const isDecrease = revision.diff < 0;
  const revDate = new Date(revision.changed_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const addendumNumber = `ADD-${client.name
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 4)
    .toUpperCase()}-${String(revision.id).slice(-4).toUpperCase()}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl p-0">
        {/* Top bar controls (hidden in print) */}
        <div className="print-hide flex items-center justify-between border-b bg-muted/40 px-6 py-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Contract Addendum Preview</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handlePrint}>
              <Printer className="mr-1.5 h-4 w-4" />
              Print / Save as PDF
            </Button>
          </div>
        </div>

        {/* Printable Contract Addendum Document */}
        <div className="p-8 sm:p-10 bg-card text-foreground print:p-0 print:border-0">
          {/* Header */}
          <div className="flex items-start justify-between border-b pb-6">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">{companyName}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Commercial Contracts & Billing Administration</p>
            </div>
            <div className="text-right">
              <span className="inline-block rounded border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                Contract Addendum
              </span>
              <p className="mt-1.5 text-xs font-mono font-medium text-foreground">{addendumNumber}</p>
              <p className="text-[11px] text-muted-foreground">Date: {revDate}</p>
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
              <p className="text-muted-foreground mt-0.5">Author/Auditor: {revision.actor || "Authorized Admin"}</p>
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
              <strong className="text-foreground">{revDate}</strong>, by and between{" "}
              <strong className="text-foreground">{companyName}</strong> and{" "}
              <strong className="text-foreground">{client.name}</strong> ({client.company}).
            </p>
            <p>
              WHEREAS, the parties entered into an active service agreement for professional services; and
              WHEREAS, the parties have reviewed and agreed upon revised commercial terms as set forth in the amendment schedule below.
            </p>
          </div>

          {/* Pricing Diff Table */}
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
                      {revision.old_service || client.service || "Standard Services"}
                    </td>
                    <td className="p-2.5 font-medium text-foreground">
                      {revision.new_service || client.service}
                    </td>
                    <td className="p-2.5 text-right text-muted-foreground">
                      {revision.old_service && revision.old_service !== revision.new_service
                        ? "Scope Updated"
                        : "Unchanged"}
                    </td>
                  </tr>
                  <tr className="bg-muted/10">
                    <td className="p-2.5 font-medium text-foreground">Monthly Fee (Retainer)</td>
                    <td className="p-2.5 tabular-nums text-muted-foreground">
                      {revision.old_price !== null ? formatCurrency(revision.old_price) : "—"}
                    </td>
                    <td className="p-2.5 font-bold tabular-nums text-foreground">
                      {formatCurrency(revision.new_price)}
                    </td>
                    <td className="p-2.5 text-right font-bold tabular-nums">
                      {revision.old_price !== null ? (
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
                    <td className="p-2.5 text-muted-foreground">
                      {formatDate(client.created_at)}
                    </td>
                    <td className="p-2.5 font-medium text-foreground">{revDate}</td>
                    <td className="p-2.5 text-right text-muted-foreground">Immediate Effect</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Legal statement */}
          <div className="mt-5 rounded-md border border-border/80 bg-muted/10 p-3 text-[11px] text-muted-foreground leading-relaxed">
            <p className="font-semibold text-foreground mb-0.5">Affirmation of Contract Terms:</p>
            Except as expressly modified herein, all covenants, agreements, and terms of the original agreement shall continue in full force and effect. This document constitutes a formal audited addendum to the commercial record.
          </div>

          {/* Execution / Signatures */}
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
      </DialogContent>
    </Dialog>
  );
}
