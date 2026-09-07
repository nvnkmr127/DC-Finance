"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
// autoDaily: shows a cached summary and regenerates automatically whenever the
// underlying data changes (fingerprint of the context), so it always reflects
// what's on the dashboard — and it refreshes fresh each new day.
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
  const lastFp = useRef<string | null>(null);

  // Fingerprint of the data + day: changes when figures change or the date rolls.
  const fingerprint = useMemo(
    () => `${new Date().toISOString().slice(0, 10)}|${JSON.stringify(context)}`,
    [context],
  );
  const cacheKey = "ai-daily-summary";

  async function generate() {
    setLoading(true);
    setErr(null);
    try {
      const text = await askAi({ mode: "insights", currency, context });
      setInsights(text);
      if (autoDaily) {
        try { localStorage.setItem(cacheKey, JSON.stringify({ fp: fingerprint, text })); } catch { /* non-fatal */ }
        setAsOf(new Date().toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  // Auto-summary: reuse the cache when the data is unchanged, else regenerate.
  useEffect(() => {
    if (!autoDaily || lastFp.current === fingerprint) return;
    lastFp.current = fingerprint;
    let cached: { fp: string; text: string } | null = null;
    try {
      const raw = localStorage.getItem(cacheKey);
      cached = raw ? JSON.parse(raw) : null;
    } catch { /* ignore */ }
    if (cached && cached.fp === fingerprint) {
      setInsights(cached.text);
      setAsOf(new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" }));
    } else {
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDaily, fingerprint]);

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
                ? `Updated ${asOf} · refreshes when your data changes`
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
