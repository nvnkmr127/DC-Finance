"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

async function askAi(payload: object): Promise<string> {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "AI request failed");
  return data.text as string;
}

// Dashboard insights card. Chat lives in the floating AiChatWidget.
export function AiPanel({ context, currency }: { context: unknown; currency: string }) {
  const [insights, setInsights] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setErr(null);
    try {
      setInsights(await askAi({ mode: "insights", currency, context }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            AI Insights
          </CardTitle>
          <CardDescription>Plain-English read on this month, powered by AI</CardDescription>
        </div>
        <Button onClick={generate} disabled={loading} size="sm">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {insights ? "Regenerate" : "Generate"}
        </Button>
      </CardHeader>
      <CardContent>
        {err && <p className="text-sm text-destructive">{err}</p>}
        {insights ? (
          <div className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm leading-relaxed">
            {insights}
          </div>
        ) : (
          !err && (
            <p className="text-sm text-muted-foreground">
              Click Generate for bullet insights on margins, overspend, overdue clients, and pending salaries.
            </p>
          )
        )}
      </CardContent>
    </Card>
  );
}
