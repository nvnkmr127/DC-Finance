"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Lock,
  ArrowRight,
  Building2,
  FileText,
  Webhook,
  User,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSupabase } from "@/lib/supabase/client";

function ConsentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const clientId = searchParams.get("client_id") || "";
  const redirectUri = searchParams.get("redirect_uri") || "";
  const responseType = searchParams.get("response_type") || "code";
  const state = searchParams.get("state") || "";
  const scope = searchParams.get("scope") || "finance:read webhooks:write";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Parse scopes
  const requestedScopes = scope.split(/\s+/).filter(Boolean);

  useEffect(() => {
    (async () => {
      try {
        const supabase = getSupabase();
        const { data } = await supabase.auth.getUser();
        if (data?.user?.email) {
          setUserEmail(data.user.email);
        }
      } catch {
        // Fallback for standalone / local dev
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleApprove = () => {
    setSubmitting(true);
    const target = new URL("/api/oauth/authorize", window.location.origin);
    target.searchParams.set("client_id", clientId);
    target.searchParams.set("redirect_uri", redirectUri);
    target.searchParams.set("response_type", responseType);
    if (state) target.searchParams.set("state", state);
    target.searchParams.set("scope", scope);
    target.searchParams.set("consent", "approved");

    window.location.href = target.toString();
  };

  const handleDeny = () => {
    if (!redirectUri) {
      router.push("/");
      return;
    }
    const target = new URL(redirectUri);
    target.searchParams.set("error", "access_denied");
    target.searchParams.set("error_description", "The user denied the authorization request");
    if (state) target.searchParams.set("state", state);
    window.location.href = target.toString();
  };

  const redirectHost = (() => {
    try {
      return new URL(redirectUri).hostname;
    } catch {
      return redirectUri;
    }
  })();

  const appDisplayName = clientId.includes("chatgpt")
    ? "ChatGPT Custom Action"
    : clientId;

  if (!clientId || !redirectUri) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-muted/20">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <XCircle className="h-5 w-5" /> Invalid Request
            </CardTitle>
            <CardDescription>
              Missing required OAuth parameters: <code>client_id</code> and <code>redirect_uri</code> are mandatory.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-b from-background to-muted/30">
      <Card className="max-w-lg w-full shadow-lg border-primary/20">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl font-bold">Authorize Access</CardTitle>
          <CardDescription className="text-sm">
            <span className="font-semibold text-foreground">{appDisplayName}</span> wants to connect to your Digicloudify Finance account.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* User badge */}
          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3.5 py-2.5 text-xs text-muted-foreground border">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span>Signed in as:</span>
              <span className="font-medium text-foreground">{userEmail || "Administrator"}</span>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono">
              OAuth 2.0
            </Badge>
          </div>

          {/* Destination */}
          <div className="rounded-lg border p-3 text-xs space-y-1 bg-card">
            <div className="text-muted-foreground">Redirecting to:</div>
            <div className="font-mono text-foreground break-all flex items-center gap-1.5">
              <Lock className="h-3 w-3 text-emerald-500" />
              {redirectHost}
            </div>
          </div>

          {/* Permissions requested */}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Permissions Requested
            </div>
            <div className="space-y-2 rounded-lg border p-3 divide-y divide-border">
              {requestedScopes.includes("finance:read") || requestedScopes.includes("*") ? (
                <div className="flex items-start gap-3 pt-2 first:pt-0">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 mt-0.5">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-foreground">Read Financial Records</div>
                    <div className="text-[11px] text-muted-foreground">
                      Access invoices, balances, payments, expenses, clients, and financial summaries.
                    </div>
                  </div>
                </div>
              ) : null}

              {requestedScopes.includes("webhooks:write") || requestedScopes.includes("*") ? (
                <div className="flex items-start gap-3 pt-2 first:pt-0">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 mt-0.5">
                    <Webhook className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-foreground">Manage Webhooks</div>
                    <div className="text-[11px] text-muted-foreground">
                      Create, test, and trigger outbound webhook event notifications.
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Any additional custom scopes */}
              {requestedScopes
                .filter((s) => s !== "finance:read" && s !== "webhooks:write" && s !== "*")
                .map((customScope) => (
                  <div key={customScope} className="flex items-start gap-3 pt-2 first:pt-0">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground mt-0.5">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-mono font-medium text-foreground">{customScope}</div>
                      <div className="text-[11px] text-muted-foreground">
                        Custom application scope access.
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground text-center">
            You can revoke this access at any time from your settings. Tokens expire after 1 hour and refresh automatically.
          </p>
        </CardContent>

        <CardFooter className="flex items-center gap-3 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleDeny}
            disabled={submitting || loading}
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleApprove}
            disabled={submitting || loading}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            Authorize & Continue
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function OAuthAuthorizePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ConsentContent />
    </Suspense>
  );
}
