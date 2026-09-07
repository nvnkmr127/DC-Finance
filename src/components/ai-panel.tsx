"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Loader2, Send } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichText } from "@/components/rich-text";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

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

  // Follow-up questions about the summary, grounded in the same dashboard data.
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [chatting, setChatting] = useState(false);

  async function ask() {
    const q = input.trim();
    if (!q || chatting) return;
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next);
    setInput("");
    setChatting(true);
    try {
      // Seed the thread with the summary itself so questions are genuine
      // follow-ups ("expand on point 2", "why did you say cash is negative?").
      const thread = insights
        ? [{ role: "assistant" as const, content: `Here is the summary I gave you:\n\n${insights}` }, ...next]
        : next;
      const reply = await askAi({ mode: "chat", currency, context, messages: thread });
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages([...next, { role: "assistant", content: `⚠️ ${e instanceof Error ? e.message : "Failed"}` }]);
    } finally {
      setChatting(false);
    }
  }

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
          <div className="rounded-md border bg-muted/30 p-3">
            <RichText text={insights} />
          </div>
        ) : (
          !err && (
            <p className="text-sm text-muted-foreground">
              Click Generate for bullet insights on margins, overspend, overdue clients, and pending salaries.
            </p>
          )
        )}

        {/* Follow-up questions about the summary */}
        {insights && (
          <div className="mt-4 space-y-3 border-t pt-3">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <span
                  className={cn(
                    "inline-block max-w-[90%] rounded-lg px-3 py-2 text-sm",
                    m.role === "user" ? "whitespace-pre-wrap bg-primary text-primary-foreground" : "border bg-background",
                  )}
                >
                  {m.role === "user" ? m.content : <RichText text={m.content} />}
                </span>
              </div>
            ))}
            {chatting && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(); }}>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a follow-up…"
                disabled={chatting}
              />
              <Button type="submit" size="icon" disabled={chatting || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
