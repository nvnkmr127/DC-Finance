"use client";

import { useState } from "react";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export function AiPanel({ context, currency }: { context: unknown; currency: string }) {
  const [insights, setInsights] = useState("");
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insightsErr, setInsightsErr] = useState<string | null>(null);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [chatting, setChatting] = useState(false);

  async function generate() {
    setLoadingInsights(true);
    setInsightsErr(null);
    try {
      setInsights(await askAi({ mode: "insights", currency, context }));
    } catch (e) {
      setInsightsErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoadingInsights(false);
    }
  }

  async function send() {
    const q = input.trim();
    if (!q || chatting) return;
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next);
    setInput("");
    setChatting(true);
    try {
      const reply = await askAi({ mode: "chat", currency, context, messages: next });
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages([...next, { role: "assistant", content: `⚠️ ${e instanceof Error ? e.message : "Failed"}` }]);
    } finally {
      setChatting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          AI Assistant
        </CardTitle>
        <CardDescription>Insights and Q&amp;A over your current finance data</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="insights">
          <TabsList>
            <TabsTrigger value="insights">Insights</TabsTrigger>
            <TabsTrigger value="chat">Ask</TabsTrigger>
          </TabsList>

          <TabsContent value="insights" className="space-y-3">
            <Button onClick={generate} disabled={loadingInsights} size="sm">
              {loadingInsights ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {insights ? "Regenerate" : "Generate insights"}
            </Button>
            {insightsErr && <p className="text-sm text-destructive">{insightsErr}</p>}
            {insights && (
              <div className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm leading-relaxed">
                {insights}
              </div>
            )}
          </TabsContent>

          <TabsContent value="chat" className="space-y-3">
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border bg-muted/20 p-3 text-sm">
              {messages.length === 0 ? (
                <p className="text-muted-foreground">
                  Ask about this month — e.g. “Who owes me the most?” or “Where am I overspending?”
                </p>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                    <span
                      className={cn(
                        "inline-block max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2",
                        m.role === "user" ? "bg-primary text-primary-foreground" : "bg-background border",
                      )}
                    >
                      {m.content}
                    </span>
                  </div>
                ))
              )}
              {chatting && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question…"
                disabled={chatting}
              />
              <Button type="submit" size="icon" disabled={chatting || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
