"use client";

import { useState, useEffect } from "react";
import { Loader2, Save, Plus, X, Download, Pencil, Check } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { updateSettings } from "@/lib/settings";
import { exportAllData } from "@/lib/backup";
import { listServices, createService, updateService, deleteService, type Service } from "@/lib/services";
import { unitSuffix } from "@/lib/format";
import { useSettings } from "@/components/settings-provider";
import { ApiKeysManager } from "@/components/api-keys-manager";

export default function SettingsPage() {
  const { settings, loading, refreshSettings, formatCurrency } = useSettings();
  
  const [saving, setSaving] = useState(false);
  
  // Local state for the form
  const [companyName, setCompanyName] = useState("");
  const [companyLogo, setCompanyLogo] = useState("");
  const [companyGstin, setCompanyGstin] = useState("");
  const [companyState, setCompanyState] = useState("Telangana");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPan, setCompanyPan] = useState("");

  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [upiId, setUpiId] = useState("");
  const [bankBranch, setBankBranch] = useState("");

  const [currency, setCurrency] = useState("INR");
  const [fyStart, setFyStart] = useState("04-01");

  const [categories, setCategories] = useState<string[]>([]);
  const [newCat, setNewCat] = useState("");
  
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [newMethod, setNewMethod] = useState("");

  const [expenseOnlyEmails, setExpenseOnlyEmails] = useState<string[]>([]);
  const [newExpenseEmail, setNewExpenseEmail] = useState("");

  const [services, setServices] = useState<Service[]>([]);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");
  const [newServiceDesc, setNewServiceDesc] = useState("");
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");

  const [emailRemindersEnabled, setEmailRemindersEnabled] = useState(false);
  const [reminderFromEmail, setReminderFromEmail] = useState("");

  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      await exportAllData();
      toast.success("Backup downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo image must be under 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCompanyLogo(reader.result);
        toast.success("Logo loaded");
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    (async () => {
      try {
        const list = await listServices();
        setServices(list);
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  useEffect(() => {
    if (settings) {
      setCompanyName(settings.company_name);
      setCompanyLogo(settings.company_logo ?? "");
      setCompanyGstin(settings.company_gstin ?? "");
      setCompanyState(settings.company_state ?? "Telangana");
      setCompanyAddress(settings.company_address ?? "");
      setCompanyPan(settings.company_pan ?? "");
      setBankName(settings.bank_name ?? "");
      setAccountNumber(settings.account_number ?? "");
      setIfscCode(settings.ifsc_code ?? "");
      setUpiId(settings.upi_id ?? "");
      setBankBranch(settings.bank_branch ?? "");
      setCurrency(settings.default_currency);
      setFyStart(settings.financial_year_start);
      setCategories([...settings.expense_categories]);
      setPaymentMethods([...settings.payment_methods]);
      setExpenseOnlyEmails([...(settings.expense_only_emails ?? [])]);
      setEmailRemindersEnabled(settings.email_reminders_enabled);
      setReminderFromEmail(settings.reminder_from_email ?? "");
    }
  }, [settings]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const addCategory = () => {
    const val = newCat.trim();
    if (val && !categories.includes(val)) {
      setCategories([...categories, val]);
      setNewCat("");
    }
  };

  const removeCategory = (cat: string) => {
    setCategories(categories.filter((c) => c !== cat));
  };

  const addExpenseEmail = () => {
    const val = newExpenseEmail.trim().toLowerCase();
    if (val && val.includes("@") && !expenseOnlyEmails.includes(val)) {
      setExpenseOnlyEmails([...expenseOnlyEmails, val]);
      setNewExpenseEmail("");
    }
  };
  const removeExpenseEmail = (email: string) =>
    setExpenseOnlyEmails(expenseOnlyEmails.filter((e) => e !== email));

  const addMethod = () => {
    const val = newMethod.trim();
    if (val && !paymentMethods.includes(val)) {
      setPaymentMethods([...paymentMethods, val]);
      setNewMethod("");
    }
  };

  const removeMethod = (m: string) => {
    setPaymentMethods(paymentMethods.filter((c) => c !== m));
  };

  const handleAddService = async () => {
    const name = newServiceName.trim();
    if (!name) {
      toast.error("Please enter a service name");
      return;
    }
    const price = parseFloat(newServicePrice) || 0;
    try {
      const created = await createService({
        name,
        price,
        description: newServiceDesc.trim() || undefined,
      });
      setServices((prev) => [
        ...prev.filter((s) => s.name.toLowerCase() !== name.toLowerCase()),
        created,
      ]);
      setNewServiceName("");
      setNewServicePrice("");
      setNewServiceDesc("");
      toast.success(`Added service "${name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add service");
    }
  };

  const handleDeleteService = async (id: string, name: string) => {
    try {
      await deleteService(id);
      setServices((prev) => prev.filter((s) => s.id !== id));
      toast.success(`Removed service "${name}"`);
    } catch {
      toast.error("Failed to remove service");
    }
  };

  const handleStartEdit = (s: Service) => {
    setEditingServiceId(s.id);
    setEditPrice(String(s.price));
  };

  const handleSaveEdit = async (s: Service) => {
    const price = parseFloat(editPrice);
    if (isNaN(price) || price < 0) {
      toast.error("Please enter a valid price");
      return;
    }
    try {
      const updated = await updateService(s.id, { price });
      if (updated) {
        setServices((prev) => prev.map((item) => (item.id === s.id ? updated : item)));
        toast.success(
          s.unit === "scoped"
            ? `Updated "${s.name}" (quoted per requirement)`
            : `Updated pricing for "${s.name}" to ${formatCurrency(price)}${unitSuffix(s.unit)}`,
        );
      }
      setEditingServiceId(null);
    } catch {
      toast.error("Failed to update pricing");
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateSettings({
        company_name: companyName,
        company_logo: companyLogo.trim() || null,
        company_gstin: companyGstin.trim() || null,
        company_state: companyState.trim() || "Telangana",
        company_address: companyAddress.trim() || null,
        company_pan: companyPan.trim() || null,
        bank_name: bankName.trim() || null,
        account_number: accountNumber.trim() || null,
        ifsc_code: ifscCode.trim() || null,
        upi_id: upiId.trim() || null,
        bank_branch: bankBranch.trim() || null,
        default_currency: currency,
        financial_year_start: fyStart.trim() || "04-01",
        expense_categories: categories,
        payment_methods: paymentMethods,
        expense_only_emails: expenseOnlyEmails,
        email_reminders_enabled: emailRemindersEnabled,
        reminder_from_email: reminderFromEmail.trim() || null,
      });
      await refreshSettings();
      toast.success("Settings saved successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Settings"
        description="Manage your company profile and application preferences."
        action={
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Settings
          </Button>
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Company & GST Profile</CardTitle>
            <CardDescription>Legal company details and logo for invoices & branding.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="E.g. Digicloudify Finance"
              />
            </div>

            {/* Company Logo Section */}
            <div className="space-y-2 border-t pt-3">
              <Label>Company Logo</Label>
              {companyLogo ? (
                <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={companyLogo} alt="Company Logo Preview" className="h-12 max-w-[160px] object-contain rounded" />
                  <div className="flex-1 text-xs text-muted-foreground">
                    Logo loaded
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setCompanyLogo("")}>
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input type="file" accept="image/*" onChange={handleLogoFileChange} className="text-xs cursor-pointer" />
                  <p className="text-[11px] text-muted-foreground">Or paste an image URL:</p>
                  <Input
                    value={companyLogo}
                    onChange={(e) => setCompanyLogo(e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className="text-xs"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 border-t pt-3">
              <div className="space-y-2">
                <Label>GSTIN</Label>
                <Input
                  value={companyGstin}
                  onChange={(e) => setCompanyGstin(e.target.value.toUpperCase())}
                  placeholder="36AAAAA0000A1Z5"
                  maxLength={15}
                />
              </div>
              <div className="space-y-2">
                <Label>State / Union Territory</Label>
                <Input
                  value={companyState}
                  onChange={(e) => setCompanyState(e.target.value)}
                  placeholder="Telangana"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>PAN Number</Label>
              <Input
                value={companyPan}
                onChange={(e) => setCompanyPan(e.target.value.toUpperCase())}
                placeholder="ABCDE1234F"
                maxLength={10}
              />
            </div>
            <div className="space-y-2">
              <Label>Billing Address</Label>
              <Input
                value={companyAddress}
                onChange={(e) => setCompanyAddress(e.target.value)}
                placeholder="Plot No. 12, Hitech City, Hyderabad, Telangana 500081"
              />
            </div>
          </CardContent>
        </Card>

        {/* Bank & Remittance Details Card */}
        <Card>
          <CardHeader>
            <CardTitle>Bank & Remittance Details</CardTitle>
            <CardDescription>Bank account info printed on invoices for direct client payments.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Bank Name</Label>
              <Input
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="E.g. HDFC Bank / ICICI Bank"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Account Number</Label>
                <Input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="50200012345678"
                />
              </div>
              <div className="space-y-2">
                <Label>IFSC Code</Label>
                <Input
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                  placeholder="HDFC0001234"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>UPI ID (optional)</Label>
                <Input
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="company@upi"
                />
              </div>
              <div className="space-y-2">
                <Label>Branch Name</Label>
                <Input
                  value={bankBranch}
                  onChange={(e) => setBankBranch(e.target.value)}
                  placeholder="Hitech City, Hyderabad"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financial Preferences</CardTitle>
            <CardDescription>Default currency used across the app.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Default Currency</Label>
                <Input
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  placeholder="INR"
                />
              </div>
              <div className="space-y-2">
                <Label>Financial Year Start</Label>
                <Input
                  value={fyStart}
                  onChange={(e) => setFyStart(e.target.value)}
                  placeholder="MM-DD (e.g. 04-01)"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expense Categories</CardTitle>
            <CardDescription>Customize the categories available for expenses.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                placeholder="New category..."
                onKeyDown={(e) => e.key === "Enter" && addCategory()}
              />
              <Button type="button" variant="secondary" onClick={addCategory}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <div
                  key={c}
                  className="flex items-center gap-1 rounded-md bg-muted px-3 py-1 text-sm font-medium"
                >
                  {c}
                  <button
                    type="button"
                    aria-label={`Remove ${c}`}
                    onClick={() => removeCategory(c)}
                    className="ml-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
            <CardDescription>Methods available for transactions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={newMethod}
                onChange={(e) => setNewMethod(e.target.value)}
                placeholder="New method..."
                onKeyDown={(e) => e.key === "Enter" && addMethod()}
              />
              <Button type="button" variant="secondary" onClick={addMethod}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {paymentMethods.map((m) => (
                <div
                  key={m}
                  className="flex items-center gap-1 rounded-md bg-muted px-3 py-1 text-sm font-medium"
                >
                  {m}
                  <button
                    type="button"
                    aria-label={`Remove ${m}`}
                    onClick={() => removeMethod(m)}
                    className="ml-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Expense-Only Logins</CardTitle>
            <CardDescription>
              Users signed in with these emails can only reach the Expenses page — no dashboard, clients, salaries, reports or AI.
              They still need to sign up / sign in normally first.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="email"
                value={newExpenseEmail}
                onChange={(e) => setNewExpenseEmail(e.target.value)}
                placeholder="person@company.in"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addExpenseEmail())}
              />
              <Button type="button" variant="secondary" onClick={addExpenseEmail}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {expenseOnlyEmails.length === 0 ? (
              <p className="text-sm text-muted-foreground">No restricted logins. Everyone signed in has full access.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {expenseOnlyEmails.map((email) => (
                  <div key={email} className="flex items-center gap-1 rounded-md bg-muted px-3 py-1 text-sm font-medium">
                    {email}
                    <button
                      type="button"
                      aria-label={`Remove ${email}`}
                      onClick={() => removeExpenseEmail(email)}
                      className="ml-1 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
              This restricts the interface only. For a hard boundary (so these users can&apos;t reach other data via the API),
              per-role database rules (RLS) are also needed — ask to have those added. Don&apos;t add your own admin email here.
            </p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Services & Pricing</CardTitle>
            <CardDescription>
              Preset services with default monthly pricing. These appear as live AJAX search results when adding or editing clients.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-12">
              <div className="sm:col-span-5">
                <Input
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  placeholder="Service name (e.g. Cloud Hosting)..."
                  onKeyDown={(e) => e.key === "Enter" && handleAddService()}
                />
              </div>
              <div className="sm:col-span-3">
                <Input
                  type="number"
                  min="0"
                  value={newServicePrice}
                  onChange={(e) => setNewServicePrice(e.target.value)}
                  placeholder={`Price (${currency})...`}
                  onKeyDown={(e) => e.key === "Enter" && handleAddService()}
                />
              </div>
              <div className="sm:col-span-3">
                <Input
                  value={newServiceDesc}
                  onChange={(e) => setNewServiceDesc(e.target.value)}
                  placeholder="Description (optional)..."
                  onKeyDown={(e) => e.key === "Enter" && handleAddService()}
                />
              </div>
              <div className="sm:col-span-1">
                <Button type="button" variant="secondary" className="w-full" onClick={handleAddService}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="divide-y rounded-md border text-sm max-h-72 overflow-y-auto">
              {services.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  No preset services configured yet. Add your first service above.
                </div>
              ) : (
                services.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 hover:bg-muted/30">
                    <div className="min-w-0 pr-3">
                      <div className="font-medium text-foreground">{s.name}</div>
                      {s.description && (
                        <div className="text-xs text-muted-foreground truncate">{s.description}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {editingServiceId === s.id ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            min="0"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            className="h-7 w-28 text-xs tabular-nums"
                            onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(s)}
                            autoFocus
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="default"
                            className="h-7 w-7"
                            title="Save price"
                            onClick={() => handleSaveEdit(s)}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title="Cancel"
                            onClick={() => setEditingServiceId(null)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span className="font-semibold text-primary tabular-nums">
                            {s.unit === "scoped" ? (
                              "Quoted"
                            ) : (
                              <>
                                {formatCurrency(s.price)}
                                <span className="text-xs font-normal text-muted-foreground">
                                  {unitSuffix(s.unit)}
                                </span>
                              </>
                            )}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Edit pricing"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => handleStartEdit(s)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Remove service"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteService(s.id, s.name)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Email Reminders</CardTitle>
            <CardDescription>
              Send overdue-invoice reminders by email from the Collections page (via Resend).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-start gap-3 rounded-md border bg-muted/30 px-3 py-2.5">
              <Checkbox
                id="email_reminders"
                checked={emailRemindersEnabled}
                onCheckedChange={(v) => setEmailRemindersEnabled(v === true)}
                className="mt-0.5"
              />
              <div>
                <span className="text-sm font-medium">Enable email reminders</span>
                <p className="text-xs text-muted-foreground">
                  When on, Collections shows a “Send email” action for invoices whose client has an
                  email address.
                </p>
              </div>
            </label>
            <div className="space-y-2">
              <Label>From email</Label>
              <Input
                type="email"
                value={reminderFromEmail}
                onChange={(e) => setReminderFromEmail(e.target.value)}
                placeholder="billing@yourdomain.com"
                disabled={!emailRemindersEnabled}
              />
              <p className="text-xs text-muted-foreground">
                Must be an address on a domain verified in Resend. The Resend API key is configured
                on the server (<code>RESEND_API_KEY</code>), not here.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-2">
          <ApiKeysManager />
        </div>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Data & Backup</CardTitle>
            <CardDescription>Download a full copy of your data as JSON.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={handleExport} disabled={exporting}>
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Export all data
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
