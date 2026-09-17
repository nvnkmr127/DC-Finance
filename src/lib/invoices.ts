import { z } from "zod";
import { getSupabase } from "@/lib/supabase/client";
import type { BillingCycle } from "@/lib/clients";
import { dispatchWebhookEvent } from "@/lib/webhooks";

// ---- Validation ----------------------------------------------------------

export const invoiceItemSchema = z.object({
  description: z.string().min(1, "Description is required").max(200),
  quantity: z.number({ error: "Enter a quantity" }).positive("Must be greater than 0"),
  unit_price: z.number({ error: "Enter a price" }).min(0, "Must be 0 or more"),
});

export const invoiceSchema = z.object({
  client_id: z.string().min(1, "Select a client"),
  issue_date: z.string().min(1, "Select an issue date"),
  due_date: z.string().min(1, "Select a due date"),
  status: z.enum(["draft", "sent", "cancelled"]),
  notes: z.string().max(1000).optional().or(z.literal("")),
  is_gst_invoice: z.boolean().default(false),
  is_tax_inclusive: z.boolean().default(false),
  hsn_sac: z.string().max(20).default("998314"),
  gst_rate: z.number().min(0).max(100).default(18),
  tax_type: z.enum(["cgst_sgst", "igst"]).default("cgst_sgst"),
  reverse_charge: z.boolean().default(false),
  items: z.array(invoiceItemSchema).min(1, "Add at least one line item"),
});

export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;
export type InvoiceInput = z.input<typeof invoiceSchema>;
export type InvoiceParsed = z.infer<typeof invoiceSchema>;

// ---- Types ---------------------------------------------------------------

export type InvoiceItem = InvoiceItemInput & {
  id: string;
  invoice_id: string;
  amount: number;
};

// Row from the `invoice_summary` view (invoice + client + payment-derived totals).
export type InvoiceSummary = {
  id: string;
  invoice_number: string;
  client_id: string;
  client_name: string;
  client_company: string;
  client_gstin?: string | null;
  client_state?: string | null;
  client_address?: string | null;
  issue_date: string;
  due_date: string;
  status: "draft" | "sent" | "cancelled";
  display_status: "draft" | "sent" | "cancelled" | "paid" | "partial";
  notes: string | null;
  is_gst_invoice?: boolean;
  is_tax_inclusive?: boolean;
  hsn_sac?: string | null;
  gst_rate?: number | null;
  tax_type?: "cgst_sgst" | "igst" | null;
  reverse_charge?: boolean;
  subtotal?: number | null;
  tax_amount?: number | null;
  total: number;
  paid: number;
  balance: number;
  last_reminded_at: string | null;
  created_at: string;
};

// ---- Helpers -------------------------------------------------------------

export const lineAmount = (i: { quantity: number; unit_price: number }): number =>
  i.quantity * i.unit_price;

export const invoiceTotal = (items: { quantity: number; unit_price: number }[]): number =>
  items.reduce((s, i) => s + lineAmount(i), 0);

export type GstBreakdown = {
  subtotal: number;
  isGst: boolean;
  isTaxInclusive: boolean;
  gstRate: number;
  taxType: "cgst_sgst" | "igst";
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalTax: number;
  grandTotal: number;
};

export function calculateGstBreakdown(
  rawAmount: number,
  isGstInvoice = false,
  gstRate = 18,
  isTaxInclusive = false,
  companyState?: string | null,
  clientState?: string | null
): GstBreakdown {
  if (!isGstInvoice || rawAmount <= 0) {
    return {
      subtotal: rawAmount,
      isGst: false,
      isTaxInclusive: false,
      gstRate: 0,
      taxType: "cgst_sgst",
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate: 0,
      igstAmount: 0,
      totalTax: 0,
      grandTotal: rawAmount,
    };
  }

  const compState = (companyState || "Telangana").trim().toLowerCase();
  const cliState = (clientState || "Telangana").trim().toLowerCase();
  const isIntraState = compState === cliState;
  const taxType = isIntraState ? "cgst_sgst" : "igst";

  let subtotal = rawAmount;
  let grandTotal = rawAmount;
  let totalTax = 0;

  if (isTaxInclusive) {
    grandTotal = rawAmount;
    subtotal = Math.round((rawAmount / (1 + gstRate / 100)) * 100) / 100;
    totalTax = Math.round((grandTotal - subtotal) * 100) / 100;
  } else {
    subtotal = rawAmount;
    totalTax = Math.round((subtotal * (gstRate / 100)) * 100) / 100;
    grandTotal = Math.round((subtotal + totalTax) * 100) / 100;
  }

  if (taxType === "cgst_sgst") {
    const cgstRate = gstRate / 2;
    const sgstRate = gstRate / 2;
    const cgstAmount = Math.round((totalTax / 2) * 100) / 100;
    const sgstAmount = Math.round((totalTax - cgstAmount) * 100) / 100;
    return {
      subtotal,
      isGst: true,
      isTaxInclusive,
      gstRate,
      taxType: "cgst_sgst",
      cgstRate,
      cgstAmount,
      sgstRate,
      sgstAmount,
      igstRate: 0,
      igstAmount: 0,
      totalTax,
      grandTotal,
    };
  } else {
    return {
      subtotal,
      isGst: true,
      isTaxInclusive,
      gstRate,
      taxType: "igst",
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate: gstRate,
      igstAmount: totalTax,
      totalTax,
      grandTotal,
    };
  }
}

export function numberToIndianWords(amount: number): string {
  if (isNaN(amount) || amount === 0) return "INR Zero Only";
  const num = Math.round(amount);
  const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convertTwoDigits(n: number): string {
    if (n < 20) return units[n];
    return `${tens[Math.floor(n / 10)]}${n % 10 !== 0 ? " " + units[n % 10] : ""}`;
  }

  function convertThreeDigits(n: number): string {
    let str = "";
    if (Math.floor(n / 100) > 0) {
      str += `${units[Math.floor(n / 100)]} Hundred`;
    }
    const rem = n % 100;
    if (rem > 0) {
      str += str ? ` ${convertTwoDigits(rem)}` : convertTwoDigits(rem);
    }
    return str;
  }

  let result = "";
  let n = num;

  if (Math.floor(n / 10000000) > 0) {
    result += `${convertTwoDigits(Math.floor(n / 10000000))} Crore `;
    n %= 10000000;
  }
  if (Math.floor(n / 100000) > 0) {
    result += `${convertTwoDigits(Math.floor(n / 100000))} Lakh `;
    n %= 100000;
  }
  if (Math.floor(n / 1000) > 0) {
    result += `${convertTwoDigits(Math.floor(n / 1000))} Thousand `;
    n %= 1000;
  }
  if (n > 0) {
    result += convertThreeDigits(n);
  }

  return `INR ${result.trim()} Only`;
}

// Next sequential number (INV-0001). Derived from the highest existing suffix so
// it survives deletions. Single-user tool, so the tiny concurrent-insert race is
// acceptable — the unique constraint would reject a genuine collision.
export async function nextInvoiceNumber(): Promise<string> {
  const { data, error } = await getSupabase()
    .from("invoices")
    .select("invoice_number")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const last = data?.[0]?.invoice_number ?? "";
  const n = Number(last.match(/(\d+)\s*$/)?.[1] ?? 0) + 1;
  return `INV-${String(n).padStart(4, "0")}`;
}

// ---- Data access ---------------------------------------------------------

export async function listInvoices(): Promise<InvoiceSummary[]> {
  const { data, error } = await getSupabase()
    .from("invoice_summary")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as InvoiceSummary[];
}

export async function getInvoice(id: string): Promise<InvoiceSummary> {
  const { data, error } = await getSupabase()
    .from("invoice_summary")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data as InvoiceSummary;
}

export async function getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
  const { data, error } = await getSupabase()
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", invoiceId);
  if (error) throw new Error(error.message);
  return data as InvoiceItem[];
}

export async function createInvoice(input: InvoiceInput): Promise<void> {
  const supabase = getSupabase();
  const invoice_number = await nextInvoiceNumber();
  const rawTotal = invoiceTotal(input.items);
  const is_gst_invoice = input.is_gst_invoice ?? false;
  const is_tax_inclusive = input.is_tax_inclusive ?? false;
  const gst_rate = input.gst_rate ?? 18;
  const gst = calculateGstBreakdown(rawTotal, is_gst_invoice, gst_rate, is_tax_inclusive);

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      invoice_number,
      client_id: input.client_id,
      issue_date: input.issue_date,
      due_date: input.due_date,
      status: input.status,
      notes: input.notes,
      is_gst_invoice,
      is_tax_inclusive,
      hsn_sac: input.hsn_sac ?? "998314",
      gst_rate,
      tax_type: input.tax_type ?? "cgst_sgst",
      reverse_charge: input.reverse_charge ?? false,
      subtotal: gst.subtotal,
      tax_amount: gst.totalTax,
      grand_total: gst.grandTotal,
      total: gst.grandTotal,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const items = input.items.map((i) => ({
    invoice_id: data.id,
    description: i.description,
    quantity: i.quantity,
    unit_price: i.unit_price,
    amount: lineAmount(i),
  }));
  const { error: itemsError } = await supabase.from("invoice_items").insert(items);
  if (itemsError) throw new Error(itemsError.message);

  dispatchWebhookEvent("invoice.created", {
    id: data.id,
    invoice_number,
    client_id: input.client_id,
    issue_date: input.issue_date,
    due_date: input.due_date,
    status: input.status,
    total: gst.grandTotal,
    subtotal: gst.subtotal,
    tax_amount: gst.totalTax,
    is_gst_invoice,
    is_tax_inclusive,
    items,
  });
}

// Draft invoices from client billing cycles for a given month (YYYY-MM).
// Monthly clients are skipped if already invoiced that month; quarterly clients
// if invoiced in the trailing 3 months (their invoice carries the full quarter
// amount). Commission clients and zero-value clients are skipped.
// ponytail: month/quarter dedup by issue-month lookback, no stored billing anchor.
export async function generateInvoicesForMonth(
  month: string,
  clients: { id: string; service: string; monthly_value: number; billing_cycle: BillingCycle; status: string }[],
  dueDays = 7,
): Promise<{ created: number; skipped: number }> {
  const shiftMonth = (ym: string, n: number) => {
    const [y, m] = ym.split("-").map(Number);
    const d = new Date(y, m - 1 + n, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  const existing = await listInvoices();
  const active = existing.filter((i) => i.status !== "cancelled");
  const invoicedThisMonth = new Set(active.filter((i) => i.issue_date.slice(0, 7) === month).map((i) => i.client_id));
  const last3 = [month, shiftMonth(month, -1), shiftMonth(month, -2)];
  const invoicedRecently = new Set(active.filter((i) => last3.includes(i.issue_date.slice(0, 7))).map((i) => i.client_id));

  const issue_date = `${month}-01`;
  const due = new Date(`${issue_date}T00:00:00`);
  due.setDate(due.getDate() + dueDays);
  const due_date = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`;

  let created = 0, skipped = 0;
  for (const c of clients) {
    if (c.status !== "active" || c.billing_cycle === "commission" || c.monthly_value <= 0) continue;
    const dupe = c.billing_cycle === "quarterly" ? invoicedRecently.has(c.id) : invoicedThisMonth.has(c.id);
    if (dupe) { skipped++; continue; }
    await createInvoice({
      client_id: c.id,
      issue_date,
      due_date,
      status: "draft",
      notes: `Auto-generated for ${month}`,
      is_gst_invoice: false,
      is_tax_inclusive: false,
      hsn_sac: "998314",
      gst_rate: 18,
      tax_type: "cgst_sgst",
      reverse_charge: false,
      items: [{ description: `${c.service} — ${c.billing_cycle === "quarterly" ? "quarter from" : "month"} ${month}`, quantity: 1, unit_price: c.monthly_value }],
    });
    created++;
  }
  return { created, skipped };
}

export async function updateInvoice(id: string, input: InvoiceInput): Promise<void> {
  const supabase = getSupabase();
  const rawTotal = invoiceTotal(input.items);
  const is_gst_invoice = input.is_gst_invoice ?? false;
  const is_tax_inclusive = input.is_tax_inclusive ?? false;
  const gst_rate = input.gst_rate ?? 18;
  const gst = calculateGstBreakdown(rawTotal, is_gst_invoice, gst_rate, is_tax_inclusive);

  const { error } = await supabase
    .from("invoices")
    .update({
      client_id: input.client_id,
      issue_date: input.issue_date,
      due_date: input.due_date,
      status: input.status,
      notes: input.notes,
      is_gst_invoice,
      is_tax_inclusive,
      hsn_sac: input.hsn_sac ?? "998314",
      gst_rate,
      tax_type: input.tax_type ?? "cgst_sgst",
      reverse_charge: input.reverse_charge ?? false,
      subtotal: gst.subtotal,
      tax_amount: gst.totalTax,
      grand_total: gst.grandTotal,
      total: gst.grandTotal,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  // Replace line items wholesale (simplest correct approach for an edit).
  const { error: delError } = await supabase.from("invoice_items").delete().eq("invoice_id", id);
  if (delError) throw new Error(delError.message);

  const items = input.items.map((i) => ({
    invoice_id: id,
    description: i.description,
    quantity: i.quantity,
    unit_price: i.unit_price,
    amount: lineAmount(i),
  }));
  const { error: itemsError } = await supabase.from("invoice_items").insert(items);
  if (itemsError) throw new Error(itemsError.message);

  dispatchWebhookEvent("invoice.updated", {
    id,
    client_id: input.client_id,
    issue_date: input.issue_date,
    due_date: input.due_date,
    status: input.status,
    total: gst.grandTotal,
    subtotal: gst.subtotal,
    tax_amount: gst.totalTax,
    is_gst_invoice,
    is_tax_inclusive,
    items,
  });
}

export async function deleteInvoice(id: string): Promise<void> {
  const { error } = await getSupabase().from("invoices").delete().eq("id", id);
  if (error) throw new Error(error.message);
  dispatchWebhookEvent("invoice.deleted", { id });
}

// Record that a reminder was sent now (collections). Returns the timestamp.
export async function logReminder(id: string): Promise<string> {
  const now = new Date().toISOString();
  const { error } = await getSupabase()
    .from("invoices")
    .update({ last_reminded_at: now })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return now;
}
