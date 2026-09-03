"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type Field = {
  name: string;
  label: string;
  type?: "text" | "number" | "date";
  placeholder?: string;
  options?: string[];
};

// Two modes:
//  - Add:  pass `triggerLabel` (renders a "+ Add" button, self-managed open).
//  - Edit: pass `open` + `onOpenChange` + `initialValues` (controlled, no trigger).
// Provide `onSubmit` to receive the collected field values; without it the
// dialog is display-only (just closes).
export function RecordDialog({
  title,
  description,
  fields,
  triggerLabel,
  initialValues,
  open,
  onOpenChange,
  onSubmit,
}: {
  title: string;
  description?: string;
  fields: Field[];
  triggerLabel?: string;
  initialValues?: Record<string, string>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSubmit?: (values: Record<string, string>) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = open !== undefined;
  const isOpen = controlled ? open : internalOpen;
  const setOpen = controlled ? onOpenChange! : setInternalOpen;

  const [values, setValues] = useState<Record<string, string>>(
    initialValues ?? {},
  );

  // Reset the form each time the dialog opens (fresh for add, prefilled for edit).
  useEffect(() => {
    if (isOpen) setValues(initialValues ?? {});
  }, [isOpen, initialValues]);

  const set = (name: string, v: string) =>
    setValues((prev) => ({ ...prev, [name]: v }));

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {triggerLabel && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4" />
            {triggerLabel}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit?.(values);
            setOpen(false);
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {description ??
                (onSubmit
                  ? "Changes apply immediately (not persisted after refresh yet)."
                  : "Fields are for demo only — data is not saved yet.")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {fields.map((f) => (
              <div key={f.name} className="grid gap-2">
                <Label htmlFor={f.name}>{f.label}</Label>
                {f.options ? (
                  <Select
                    value={values[f.name] ?? ""}
                    onValueChange={(v) => set(f.name, v)}
                  >
                    <SelectTrigger id={f.name}>
                      <SelectValue placeholder={f.placeholder ?? "Select"} />
                    </SelectTrigger>
                    <SelectContent>
                      {f.options.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={f.name}
                    type={f.type ?? "text"}
                    placeholder={f.placeholder}
                    value={values[f.name] ?? ""}
                    onChange={(e) => set(f.name, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
