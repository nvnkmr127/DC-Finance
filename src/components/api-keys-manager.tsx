"use client";

import { useState, useEffect, useCallback } from "react";
import { Key, Plus, Copy, Check, ShieldAlert, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ApiKeyItem {
  id: string;
  name: string;
  maskedKey: string;
  created_at: string;
  revoked: boolean;
}

export function ApiKeysManager() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/api-keys");
      if (!res.ok) throw new Error("Failed to fetch keys");
      const data = await res.json();
      setKeys(data.keys || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setGenerating(true);
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: keyName || "API Key" }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to generate key");
      }
      const data = await res.json();
      setNewlyCreatedKey(data.key.key);
      setKeyName("");
      toast.success("API key generated successfully!");
      await loadKeys();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to revoke "${name}"? External clients using this key will immediately lose access.`)) {
      return;
    }
    try {
      setRevokingId(id);
      const res = await fetch(`/api/api-keys?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to revoke key");
      toast.success("API key revoked");
      await loadKeys();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke key");
    } finally {
      setRevokingId(null);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(true);
      toast.success("API key copied to clipboard!");
      setTimeout(() => setCopiedKey(false), 2500);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Key className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">API Keys (Custom GPTs & MCP)</CardTitle>
              <CardDescription className="text-xs">
                Generate secret API tokens to connect ChatGPT Actions, MCP agents, and external systems directly.
              </CardDescription>
            </div>
          </div>
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => {
              setNewlyCreatedKey(null);
              setKeyName("");
              setCreateDialogOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Generate New Key
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-1">
        {loading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : keys.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/80 p-6 text-center text-xs">
            <p className="text-muted-foreground mb-3">No custom API keys generated yet.</p>
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              onClick={() => {
                setNewlyCreatedKey(null);
                setKeyName("");
                setCreateDialogOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Generate Your First API Key
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="text-xs bg-muted/40">
                  <TableHead className="w-[180px]">Key Label</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[140px]">Created</TableHead>
                  <TableHead className="w-[80px] text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {keys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium text-foreground">
                      {k.name}
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {k.maskedKey}
                    </TableCell>
                    <TableCell>
                      {k.revoked ? (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground border-border">
                          Revoked
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40">
                          Active
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {k.created_at ? new Date(k.created_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {!k.revoked && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRevoke(k.id, k.name)}
                          disabled={revokingId === k.id}
                          title="Revoke API key"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="rounded-md bg-muted/50 p-3 text-[11px] text-muted-foreground space-y-1">
          <p className="font-medium text-foreground flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            How to use your API Key:
          </p>
          <p>
            • <strong>ChatGPT Actions</strong>: In GPT Editor → Configure → Actions → Authentication: choose <strong>API Key</strong> → <strong>Bearer</strong>, and paste the generated key.
          </p>
          <p>
            • <strong>Direct Curl / HTTP</strong>: Pass header <code>Authorization: Bearer dcf_live_...</code> or <code>x-api-key: dcf_live_...</code>.
          </p>
        </div>
      </CardContent>

      {/* Generator & Key Display Modal */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          {!newlyCreatedKey ? (
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Generate New API Key</DialogTitle>
                <DialogDescription className="text-xs">
                  Create a unique secret key for ChatGPT, external AI agents, or automated scripts.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label htmlFor="key-name" className="text-xs">Key Label</Label>
                  <Input
                    id="key-name"
                    placeholder="e.g. ChatGPT Custom GPT, Cursor Agent, Slack Bot"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    required
                    autoFocus
                    className="text-xs"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateDialogOpen(false)}
                  disabled={generating}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={generating} className="gap-1.5">
                  {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Key className="h-3.5 w-3.5" />}
                  Generate Key
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="space-y-4 py-2">
              <DialogHeader>
                <div className="flex items-center gap-2 text-emerald-600 font-semibold text-base">
                  <ShieldCheck className="h-5 w-5" />
                  API Key Created Successfully
                </div>
                <DialogDescription className="text-xs text-muted-foreground">
                  Please copy this key now. For your security, you will not be able to view it in full again after closing this window.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Your Secret API Key</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={newlyCreatedKey}
                    className="font-mono text-xs bg-muted/60 select-all"
                  />
                  <Button
                    size="sm"
                    className="gap-1.5 shrink-0"
                    onClick={() => copyToClipboard(newlyCreatedKey)}
                  >
                    {copiedKey ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedKey ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </div>

              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Store this key securely. Anyone with this key can query DC Finance data or trigger configured webhooks.
                </span>
              </div>

              <DialogFooter>
                <Button
                  className="w-full"
                  size="sm"
                  onClick={() => {
                    setCreateDialogOpen(false);
                    setNewlyCreatedKey(null);
                  }}
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
