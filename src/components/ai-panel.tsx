"use client";

import { useEffect, useRef, useState } from "react";
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
// autoDaily: generate once per calendar day and cache in localStorage, so the
// dashboard shows a fresh summary each day without a click or repeat AI calls.
export function AiPanel({
  context,
  currency,
  autoDaily = false,
}: {
  context: unknown;
  currency: string;
  autoDaily?: boolean;
}) {
  const [insights, setInsights] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [asOf, setAsOf] = useState<string | null>(null);
  const autoRan = useRef(false);

  const todayKey = () => `ai-daily-summary-${new Date().toISOString().slice(0, 10)}`;

  async function generate() {
    setLoading(true);
    setErr(null);
    try {
      const text = await askAi({ mode: "insights", currency, context });
      setInsights(text);
      if (autoDaily) {
        try {
          localStorage.setItem(todayKey(), text);
        } catch { /* storage unavailable — non-fatal */ }
        setAsOf(new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" }));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  // On mount (dashboard only): show today's cached summary, or generate it once.
  useEffect(() => {
    if (!autoDaily || autoRan.current) return;
    autoRan.current = true;
    let cached: string | null = null;
    try { cached = localStorage.getItem(todayKey()); } catch { /* ignore */ }
    if (cached) {
      setInsights(cached);
      setAsOf(new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" }));
    } else {
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDaily]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            {autoDaily ? "Daily Summary" : "AI Insights"}
          </CardTitle>
          <CardDescription>
            {autoDaily
              ? asOf
                ? `Auto-generated for ${asOf} · updates once a day`
                : "Your daily financial briefing, powered by AI"
              : "Plain-English read on this month, powered by AI"}
          </CardDescription>
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
