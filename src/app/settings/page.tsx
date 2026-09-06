"use client";

import { useState, useEffect } from "react";
import { Loader2, Save, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { updateSettings } from "@/lib/settings";
import { useSettings } from "@/components/settings-provider";

export default function SettingsPage() {
  const { settings, loading, refreshSettings } = useSettings();
  
  const [saving, setSaving] = useState(false);
  
  // Local state for the form
  const [companyName, setCompanyName] = useState("");
  const [currency, setCurrency] = useState("INR");

  const [categories, setCategories] = useState<string[]>([]);
  const [newCat, setNewCat] = useState("");
  
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [newMethod, setNewMethod] = useState("");

  const [emailRemindersEnabled, setEmailRemindersEnabled] = useState(false);
  const [reminderFromEmail, setReminderFromEmail] = useState("");

  useEffect(() => {
    if (settings) {
      setCompanyName(settings.company_name);
      setCurrency(settings.default_currency);
      setCategories([...settings.expense_categories]);
      setPaymentMethods([...settings.payment_methods]);
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

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateSettings({
        company_name: companyName,
        default_currency: currency,
        expense_categories: categories,
        payment_methods: paymentMethods,
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
            <CardTitle>Company Profile</CardTitle>
            <CardDescription>Basic information about your business.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="E.g. Acme Corp"
              />
            </div>
            {/* Logo uploading could be added here later */}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financial Preferences</CardTitle>
            <CardDescription>Default currency used across the app.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Default Currency</Label>
              <Input
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                placeholder="INR"
              />
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
      </div>
    </div>
  );
}
