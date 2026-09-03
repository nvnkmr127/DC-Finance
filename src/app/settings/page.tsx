"use client";

import { useState, useEffect } from "react";
import { Loader2, Save, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { updateSettings } from "@/lib/settings";
import { useSettings } from "@/components/settings-provider";

export default function SettingsPage() {
  const { settings, loading, refreshSettings } = useSettings();
  
  const [saving, setSaving] = useState(false);
  
  // Local state for the form
  const [companyName, setCompanyName] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [financialYearStart, setFinancialYearStart] = useState("04-01");
  
  const [categories, setCategories] = useState<string[]>([]);
  const [newCat, setNewCat] = useState("");
  
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [newMethod, setNewMethod] = useState("");

  useEffect(() => {
    if (settings) {
      setCompanyName(settings.company_name);
      setCurrency(settings.default_currency);
      setOpeningBalance(settings.global_opening_balance.toString());
      setFinancialYearStart(settings.financial_year_start);
      setCategories([...settings.expense_categories]);
      setPaymentMethods([...settings.payment_methods]);
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
        global_opening_balance: parseFloat(openingBalance) || 0,
        financial_year_start: financialYearStart,
        expense_categories: categories,
        payment_methods: paymentMethods,
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
            <CardDescription>Default currency and financial year settings.</CardDescription>
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
                  value={financialYearStart}
                  onChange={(e) => setFinancialYearStart(e.target.value)}
                  placeholder="MM-DD (e.g. 04-01)"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Global Opening Balance</Label>
              <Input
                type="number"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
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
      </div>
    </div>
  );
}
