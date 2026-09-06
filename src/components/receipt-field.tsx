"use client";

import { useRef, useState } from "react";
import { Loader2, Paperclip, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { uploadReceipt, getReceiptUrl } from "@/lib/storage";

// Upload/view a single receipt. Value is the storage path ("" = none).
export function ReceiptField({
  value,
  onChange,
}: {
  value: string;
  onChange: (path: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = await uploadReceipt(file);
      onChange(path);
      toast.success("Receipt uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function view() {
    try {
      const url = await getReceiptUrl(value);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn’t open receipt");
    }
  }

  if (value) {
    return (
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={view}>
          <ExternalLink className="h-4 w-4" />
          View receipt
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange("")}
          className="text-muted-foreground"
        >
          <X className="h-4 w-4" />
          Remove
        </Button>
      </div>
    );
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={onFile}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
        {uploading ? "Uploading…" : "Attach receipt"}
      </Button>
    </div>
  );
}
