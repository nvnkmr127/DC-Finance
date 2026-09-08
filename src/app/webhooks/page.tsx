"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Webhook as WebhookIcon,
  Plus,
  Play,
  Pencil,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  AlertCircle,
  ExternalLink,
  Shield,
  Activity,
  ArrowUpRight,
  Bot,
  Terminal,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { ApiKeysManager } from "@/components/api-keys-manager";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  WEBHOOK_EVENTS,
  listWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  listWebhookDeliveries,
  testWebhook,
  redeliverWebhook,
  generateWebhookSecret,
  type Webhook,
  type WebhookDelivery,
} from "@/lib/webhooks";
import { cn } from "@/lib/utils";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const MCP_CONFIG_JSON = JSON.stringify(
  {
    mcpServers: {
      "dc-finance": {
        command: "npx",
        args: ["-y", "tsx", "scripts/mcp-server.ts"],
        cwd: "/Users/naveenadicharla/Documents/DC Finance",
      },
    },
  },
  null,
  2,
);

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("endpoints");

  // Filter state for deliveries
  const [filterWebhookId, setFilterWebhookId] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Create / Edit Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formSecret, setFormSecret] = useState("");
  const [formEvents, setFormEvents] = useState<string[]>(["*"]);
  const [formActive, setFormActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Secret visibility map
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});

  // Delivery Detail Dialog
  const [inspectDelivery, setInspectDelivery] = useState<WebhookDelivery | null>(null);
  const [inspectOpen, setInspectOpen] = useState(false);

  // Testing & Redelivery states
  const [testingId, setTestingId] = useState<string | null>(null);
  const [redeliveringId, setRedeliveringId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [whs, dels] = await Promise.all([listWebhooks(), listWebhookDeliveries({ limit: 100 })]);
      setWebhooks(whs);
      setDeliveries(dels);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load webhook data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreateDialog = () => {
    setEditingWebhook(null);
    setFormName("");
    setFormUrl("");
    setFormSecret(generateWebhookSecret());
    setFormEvents(["*"]);
    setFormActive(true);
    setDialogOpen(true);
  };

  const openEditDialog = (wh: Webhook) => {
    setEditingWebhook(wh);
    setFormName(wh.name);
    setFormUrl(wh.url);
    setFormSecret(wh.secret);
    setFormEvents(wh.events);
    setFormActive(wh.is_active);
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formUrl.trim()) {
      toast.error("Name and URL are required");
      return;
    }
    try {
      setSubmitting(true);
      if (editingWebhook) {
        await updateWebhook(editingWebhook.id, {
          name: formName,
          url: formUrl,
          secret: formSecret,
          events: formEvents,
          is_active: formActive,
        });
        toast.success("Webhook updated successfully");
      } else {
        await createWebhook({
          name: formName,
          url: formUrl,
          secret: formSecret,
          events: formEvents,
          is_active: formActive,
        });
        toast.success("Webhook created successfully");
      }
      setDialogOpen(false);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save webhook");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete webhook "${name}"? All past delivery logs will also be removed.`)) {
      return;
    }
    try {
      await deleteWebhook(id);
      toast.success("Webhook deleted");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete webhook");
    }
  };

  const handleToggleActive = async (wh: Webhook) => {
    try {
      await updateWebhook(wh.id, { is_active: !wh.is_active });
      toast.success(wh.is_active ? "Webhook paused" : "Webhook activated");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update webhook status");
    }
  };

  const handleTestPing = async (id: string) => {
    try {
      setTestingId(id);
      const res = await testWebhook(id);
      if (res.success) {
        toast.success(`Ping delivered! Status: ${res.status_code} (${res.execution_time_ms}ms)`);
      } else {
        toast.error(`Ping failed: ${res.error || `HTTP ${res.status_code}`}`);
      }
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test ping failed");
    } finally {
      setTestingId(null);
    }
  };

  const handleRedeliver = async (deliveryId: string) => {
    try {
      setRedeliveringId(deliveryId);
      const res = await redeliverWebhook(deliveryId);
      if (res.success) {
        toast.success(`Redelivery succeeded! Status: ${res.status_code} (${res.execution_time_ms}ms)`);
      } else {
        toast.error(`Redelivery failed: ${res.error || `HTTP ${res.status_code}`}`);
      }
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Redelivery failed");
    } finally {
      setRedeliveringId(null);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const toggleSecretVisibility = (id: string) => {
    setVisibleSecrets((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleEventSelection = (eventName: string) => {
    if (eventName === "*") {
      setFormEvents(["*"]);
      return;
    }

    setFormEvents((prev) => {
      const filtered = prev.filter((e) => e !== "*");
      if (filtered.includes(eventName)) {
        const next = filtered.filter((e) => e !== eventName);
        return next.length === 0 ? ["*"] : next;
      } else {
        return [...filtered, eventName];
      }
    });
  };

  // Stats
  const totalEndpoints = webhooks.length;
  const activeEndpoints = webhooks.filter((w) => w.is_active).length;
  const totalDeliveries = deliveries.length;
  const successDeliveries = deliveries.filter((d) => d.success).length;
  const successRate = totalDeliveries > 0 ? Math.round((successDeliveries / totalDeliveries) * 100) : 100;

  // Filtered deliveries
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((d) => {
      if (filterWebhookId !== "all" && d.webhook_id !== filterWebhookId) return false;
      if (filterStatus === "success" && !d.success) return false;
      if (filterStatus === "failed" && d.success) return false;
      return true;
    });
  }, [deliveries, filterWebhookId, filterStatus]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Webhooks"
        description="Dispatch real-time event notifications with HMAC-SHA256 signatures to external services."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button size="sm" onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Webhook
            </Button>
          </div>
        }
      />

      {/* Metrics Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Endpoints</CardTitle>
            <WebhookIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEndpoints}</div>
            <p className="text-xs text-muted-foreground">{activeEndpoints} active and listening</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Subscriptions</CardTitle>
            <Activity className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeEndpoints}</div>
            <p className="text-xs text-muted-foreground">
              {totalEndpoints - activeEndpoints} paused
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Deliveries Recorded</CardTitle>
            <Send className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDeliveries}</div>
            <p className="text-xs text-muted-foreground">Recent outbound requests</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Delivery Success Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successRate}%</div>
            <p className="text-xs text-muted-foreground">
              {successDeliveries} succeeded · {totalDeliveries - successDeliveries} failed
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="endpoints" className="flex items-center gap-2">
            <WebhookIcon className="h-4 w-4" />
            Endpoints ({webhooks.length})
          </TabsTrigger>
          <TabsTrigger value="deliveries" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Delivery Logs ({deliveries.length})
          </TabsTrigger>
          <TabsTrigger value="ai-mcp" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            MCP & AI Connectors
          </TabsTrigger>
        </TabsList>

        {/* Endpoints Tab */}
        <TabsContent value="endpoints" className="space-y-4">
          {webhooks.length === 0 ? (
            <Card className="flex flex-col items-center justify-center p-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                <WebhookIcon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold">No webhook endpoints configured</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-6">
                Add an HTTPS URL to start receiving real-time notifications for payments, invoices, expenses, and clients.
              </p>
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Webhook
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {webhooks.map((wh) => {
                const isSecretVisible = visibleSecrets[wh.id] || false;
                const isAllEvents = wh.events.includes("*");

                return (
                  <Card key={wh.id} className="relative overflow-hidden transition-all hover:border-primary/40">
                    <div
                      className={cn(
                        "absolute left-0 top-0 bottom-0 w-1",
                        wh.is_active ? "bg-emerald-500" : "bg-muted-foreground/30",
                      )}
                    />
                    <CardHeader className="pb-3 pl-6">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <CardTitle className="text-base font-semibold">{wh.name}</CardTitle>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "text-[11px] font-medium uppercase tracking-wide",
                              wh.is_active
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {wh.is_active ? "Active" : "Paused"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestPing(wh.id)}
                            disabled={testingId === wh.id}
                            title="Send a test.ping payload to this URL"
                          >
                            <Play className={cn("mr-1.5 h-3.5 w-3.5", testingId === wh.id && "animate-spin")} />
                            {testingId === wh.id ? "Testing..." : "Test Ping"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleActive(wh)}
                            title={wh.is_active ? "Pause deliveries" : "Activate deliveries"}
                          >
                            {wh.is_active ? "Pause" : "Activate"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => openEditDialog(wh)}
                            title="Edit webhook"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(wh.id, wh.name)}
                            title="Delete webhook"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <CardDescription className="font-mono text-xs text-foreground/80 break-all pt-1">
                        {wh.url}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pl-6 pt-0 space-y-3">
                      {/* Subscribed Events */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-xs text-muted-foreground mr-1">Events:</span>
                        {isAllEvents ? (
                          <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                            All Events (*)
                          </Badge>
                        ) : (
                          wh.events.map((ev) => (
                            <Badge key={ev} variant="outline" className="text-xs">
                              {ev}
                            </Badge>
                          ))
                        )}
                      </div>

                      {/* Signing Secret */}
                      <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground font-mono">
                        <Shield className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                        <span className="shrink-0">Signing Secret:</span>
                        <span className="text-foreground select-all">
                          {isSecretVisible ? wh.secret : "••••••••••••••••••••••••••••••••"}
                        </span>
                        <div className="ml-auto flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggleSecretVisibility(wh.id)}
                            className="p-1 hover:text-foreground rounded"
                            title={isSecretVisible ? "Hide secret" : "Reveal secret"}
                          >
                            {isSecretVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(wh.secret, "Secret")}
                            className="p-1 hover:text-foreground rounded"
                            title="Copy secret"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Integration Security Note */}
          <Card className="border-dashed bg-muted/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                How to verify webhook signatures
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2">
              <p>
                Every request contains a signature header:{" "}
                <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">
                  X-Webhook-Signature: t=&lt;timestamp&gt;,v1=&lt;signature&gt;
                </code>
              </p>
              <p>
                To verify, compute HMAC-SHA256 of{" "}
                <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">
                  &quot;&lt;timestamp&gt;.&quot; + raw_request_body
                </code>{" "}
                using your webhook secret, and compare against the <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">v1</code> hash.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deliveries Tab */}
        <TabsContent value="deliveries" className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-48">
              <Select value={filterWebhookId} onValueChange={setFilterWebhookId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Endpoints" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Endpoints</SelectItem>
                  {webhooks.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-36">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <p className="text-xs text-muted-foreground ml-auto">
              Showing {filteredDeliveries.length} of {deliveries.length} deliveries
            </p>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Endpoint</TableHead>
                    <TableHead className="w-[110px]">Latency</TableHead>
                    <TableHead className="w-[180px]">Delivered At</TableHead>
                    <TableHead className="w-[140px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDeliveries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                        No webhook deliveries found matching your filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDeliveries.map((del) => {
                      const isSuccess = del.success;
                      return (
                        <TableRow key={del.id} className="text-sm">
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "flex w-fit items-center gap-1 text-[11px] font-mono",
                                isSuccess
                                  ? "border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : "border-red-500/30 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
                              )}
                            >
                              {isSuccess ? (
                                <CheckCircle2 className="h-3 w-3 shrink-0" />
                              ) : (
                                <XCircle className="h-3 w-3 shrink-0" />
                              )}
                              {del.status_code ? `${del.status_code}` : "Error"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs font-medium">
                            {del.event}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-xs">
                              {del.webhooks?.name || "Deleted Webhook"}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono truncate max-w-xs">
                              {del.url}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">
                            {del.execution_time_ms ? `${del.execution_time_ms}ms` : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDate(del.delivered_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => {
                                  setInspectDelivery(del);
                                  setInspectOpen(true);
                                }}
                              >
                                View
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => handleRedeliver(del.id)}
                                disabled={redeliveringId === del.id}
                                title="Redeliver payload"
                              >
                                <RefreshCw className={cn("h-3 w-3", redeliveringId === del.id && "animate-spin")} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MCP & AI Connectors Tab */}
        <TabsContent value="ai-mcp" className="space-y-6">
          {/* Section 0: Frontend API Key Management */}
          <ApiKeysManager />

          {/* Section 1: Claude Desktop & Cursor (MCP Stdio) */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base font-semibold">Claude Desktop, Cursor & Antigravity (MCP Server)</CardTitle>
                </div>
                <Badge variant="outline" className="text-xs font-mono">
                  stdio JSON-RPC
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Connect external AI coding assistants directly to your DC Finance system over Model Context Protocol (MCP).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Configuration snippet (claude_desktop_config.json / settings.json):</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => copyToClipboard(MCP_CONFIG_JSON, "MCP Config")}
                >
                  <Copy className="h-3 w-3 mr-1" /> Copy Config JSON
                </Button>
              </div>

              <pre className="rounded-lg bg-muted p-3 font-mono text-[11px] overflow-x-auto">
                {MCP_CONFIG_JSON}
              </pre>

              <div className="text-muted-foreground space-y-1">
                <p>• <strong>Claude Desktop</strong>: Paste into <code>~/Library/Application Support/Claude/claude_desktop_config.json</code> and restart Claude.</p>
                <p>• <strong>Cursor</strong>: Add under Cursor Settings → Features → MCP → Add New MCP Server.</p>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: ChatGPT & Custom GPTs */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-emerald-500" />
                  <CardTitle className="text-base font-semibold">ChatGPT & Custom GPT Actions</CardTitle>
                </div>
                <Badge variant="outline" className="text-xs font-mono">
                  OpenAPI 3.1.0
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Import DC Finance into ChatGPT Custom GPT Actions to ask questions and control webhooks through ChatGPT.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="space-y-2">
                <Label className="text-xs font-medium">OpenAPI Specification URL</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={`${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/api/openapi.json`}
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0 text-xs"
                    onClick={() =>
                      copyToClipboard(
                        `${window.location.origin}/api/openapi.json`,
                        "OpenAPI URL",
                      )
                    }
                  >
                    <Copy className="h-3 w-3 mr-1" /> Copy URL
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  In ChatGPT: <strong>Explore GPTs</strong> → <strong>Create a GPT</strong> → <strong>Configure</strong> → <strong>Actions</strong> → <strong>Import from URL</strong>.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="rounded-lg border p-3 space-y-1 bg-muted/20">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-primary" />
                    Option A: API Key Auth (Simple)
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Select <strong>API Key</strong> → <strong>Bearer</strong> in ChatGPT Actions, and paste any API key generated in the section above (or your <code>DC_FINANCE_API_KEY</code>).
                  </div>
                </div>

                <div className="rounded-lg border p-3 space-y-1 bg-muted/20">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-emerald-500" />
                    Option B: OAuth 2.0 (Interactive)
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Select <strong>OAuth</strong> with Authorization URL <code>/api/oauth/authorize</code> and Token URL <code>/api/oauth/token</code> for consent-based access.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Registered Tools Reference */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Available AI & MCP Tools</CardTitle>
              <CardDescription className="text-xs">
                All external AI connections have access to the following 9 tools:
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Tool Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[120px]">Scope</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {[
                    { name: "list_webhooks", desc: "List all configured webhook subscriptions", scope: "webhooks:write" },
                    { name: "create_webhook", desc: "Create a new outbound webhook endpoint", scope: "webhooks:write" },
                    { name: "test_webhook", desc: "Send test.ping to verify an endpoint and signature", scope: "webhooks:write" },
                    { name: "list_webhook_deliveries", desc: "Inspect recent delivery logs, status codes, and latency", scope: "webhooks:write" },
                    { name: "dispatch_webhook_event", desc: "Manually fire custom events to active endpoints", scope: "webhooks:write" },
                    { name: "list_invoices", desc: "View invoices, payment status, and outstanding balances", scope: "finance:read" },
                    { name: "list_payments", desc: "View recent client payment transactions", scope: "finance:read" },
                    { name: "list_expenses", desc: "View categorized business expenses", scope: "finance:read" },
                    { name: "list_clients", desc: "View clients and monthly contract values", scope: "finance:read" },
                  ].map((tool) => (
                    <TableRow key={tool.name}>
                      <TableCell className="font-mono font-medium text-foreground">{tool.name}</TableCell>
                      <TableCell className="text-muted-foreground">{tool.desc}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {tool.scope}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{editingWebhook ? "Edit Webhook" : "Create Webhook Endpoint"}</DialogTitle>
              <DialogDescription>
                Configure where DC Finance sends event notifications and specify which events to listen to.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="wh-name">Endpoint Name</Label>
                <Input
                  id="wh-name"
                  placeholder="e.g. Accounting ERP Sync, Slack Notifications"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wh-url">Destination URL</Label>
                <Input
                  id="wh-url"
                  type="url"
                  placeholder="https://example.com/api/webhooks"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Must be an accessible HTTP or HTTPS URL accepting POST requests.
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="wh-secret">Signing Secret</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] text-primary"
                    onClick={() => setFormSecret(generateWebhookSecret())}
                  >
                    Generate New Secret
                  </Button>
                </div>
                <Input
                  id="wh-secret"
                  value={formSecret}
                  onChange={(e) => setFormSecret(e.target.value)}
                  className="font-mono text-xs"
                  required
                />
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <Label>Events to send</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px]"
                    onClick={() => setFormEvents(["*"])}
                  >
                    Select All Events
                  </Button>
                </div>

                <div className="rounded-md border p-3 max-h-48 overflow-y-auto space-y-2">
                  <label className="flex items-start gap-2.5 text-sm cursor-pointer p-1 rounded hover:bg-muted/40">
                    <Checkbox
                      checked={formEvents.includes("*")}
                      onCheckedChange={() => toggleEventSelection("*")}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-medium text-xs">All Events (*)</div>
                      <div className="text-[11px] text-muted-foreground">Send every current and future event</div>
                    </div>
                  </label>

                  {WEBHOOK_EVENTS.filter((e) => e.name !== "test.ping").map((eventItem) => {
                    const checked = formEvents.includes("*") || formEvents.includes(eventItem.name);
                    return (
                      <label
                        key={eventItem.name}
                        className="flex items-start gap-2.5 text-sm cursor-pointer p-1 rounded hover:bg-muted/40"
                      >
                        <Checkbox
                          checked={checked}
                          disabled={formEvents.includes("*")}
                          onCheckedChange={() => toggleEventSelection(eventItem.name)}
                          className="mt-0.5"
                        />
                        <div>
                          <div className="font-mono text-xs">{eventItem.name}</div>
                          <div className="text-[11px] text-muted-foreground">{eventItem.description}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="wh-active"
                  checked={formActive}
                  onCheckedChange={(checked) => setFormActive(Boolean(checked))}
                />
                <Label htmlFor="wh-active" className="text-sm font-medium leading-none cursor-pointer">
                  Endpoint is active (deliveries enabled)
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : editingWebhook ? "Save Changes" : "Create Webhook"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Inspect Delivery Dialog */}
      <Dialog open={inspectOpen} onOpenChange={setInspectOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {inspectDelivery && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between gap-2 pr-6">
                  <DialogTitle className="flex items-center gap-2 font-mono text-base">
                    {inspectDelivery.event}
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[11px]",
                        inspectDelivery.success
                          ? "bg-emerald-50 text-emerald-700 border-emerald-500/30"
                          : "bg-red-50 text-red-700 border-red-500/30",
                      )}
                    >
                      {inspectDelivery.status_code ? `HTTP ${inspectDelivery.status_code}` : "Failed"}
                    </Badge>
                  </DialogTitle>
                </div>
                <DialogDescription className="font-mono text-xs break-all pt-1">
                  Target: {inspectDelivery.url}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-3">
                  <div>
                    <span className="text-muted-foreground">Delivery ID:</span>
                    <div className="font-mono font-medium truncate">{inspectDelivery.id}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Latency:</span>
                    <div className="font-mono font-medium">{inspectDelivery.execution_time_ms}ms</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Delivered At:</span>
                    <div className="font-medium">{formatDate(inspectDelivery.delivered_at)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <div className="font-medium">{inspectDelivery.success ? "200 Success" : inspectDelivery.error || "Failed"}</div>
                  </div>
                </div>

                {inspectDelivery.error && (
                  <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 p-3 text-red-800 dark:text-red-300">
                    <div className="font-semibold mb-0.5">Error Message:</div>
                    <div className="font-mono">{inspectDelivery.error}</div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">Payload Data</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[11px]"
                      onClick={() => copyToClipboard(JSON.stringify(inspectDelivery.payload, null, 2), "Payload")}
                    >
                      <Copy className="h-3 w-3 mr-1" /> Copy JSON
                    </Button>
                  </div>
                  <pre className="rounded-lg bg-muted p-3 font-mono text-[11px] overflow-x-auto max-h-56">
                    {JSON.stringify(inspectDelivery.payload, null, 2)}
                  </pre>
                </div>

                {inspectDelivery.response_body && (
                  <div className="space-y-1.5">
                    <span className="font-semibold text-foreground">Response Body</span>
                    <pre className="rounded-lg bg-muted p-3 font-mono text-[11px] overflow-x-auto max-h-40">
                      {inspectDelivery.response_body}
                    </pre>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRedeliver(inspectDelivery.id)}
                  disabled={redeliveringId === inspectDelivery.id}
                >
                  <RefreshCw className={cn("mr-2 h-3.5 w-3.5", redeliveringId === inspectDelivery.id && "animate-spin")} />
                  Redeliver Payload
                </Button>
                <Button size="sm" onClick={() => setInspectOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
