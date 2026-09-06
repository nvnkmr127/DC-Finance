"use client";

import { useEffect, useState } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/components/settings-provider";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, MoneyInput } from "@/components/form-field";
import { ServiceSearch } from "@/components/service-search";
import {
  clientSchema,
  createClient,
  updateClient,
  type Client,
  type ClientInput,
} from "@/lib/clients";

const empty: ClientInput = {
  name: "",
  company: "",
  phone: "",
  email: "",
  service: "",
  monthly_value: 0,
  status: "active",
  notes: "",
};

export function ClientForm({
  client,
  open,
  onOpenChange,
  onSaved,
  showTrigger = false,
}: {
  client?: Client;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSaved: () => void;
  showTrigger?: boolean;
}) {
  const { formatCurrency } = useSettings();
  const [internalOpen, setInternalOpen] = useState(false);
  const [catalogPrice, setCatalogPrice] = useState<number | null>(null);
  const controlled = open !== undefined;
  const isOpen = controlled ? open : internalOpen;
  const setOpen = controlled ? onOpenChange! : setInternalOpen;

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ClientInput>({
    resolver: zodResolver(clientSchema),
    defaultValues: empty,
  });

  const currentMonthlyValue = useWatch({ control, name: "monthly_value" });

  useEffect(() => {
    if (isOpen) {
      reset(client ? { ...client } : empty);
      setCatalogPrice(null);
    }
  }, [isOpen, client, reset]);

  const onSubmit = async (values: ClientInput) => {
    try {
      if (client) {
        await updateClient(client.id, values);
        toast.success("Client updated");
      } else {
        await createClient(values);
        toast.success("Client added");
      }
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save client");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {showTrigger && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4" />
            Add Client
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{client ? "Edit Client" : "Add Client"}</DialogTitle>
            <DialogDescription>
              {client ? "Update this client's details." : "Create a new client record."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="name" required error={errors.name?.message}>
              <Input id="name" aria-invalid={!!errors.name} {...register("name")} placeholder="Full name" />
            </Field>
            <Field label="Company" htmlFor="company" required error={errors.company?.message}>
              <Input id="company" aria-invalid={!!errors.company} {...register("company")} placeholder="Company name" />
            </Field>
            <Field label="Phone" htmlFor="phone" required error={errors.phone?.message}>
              <Input id="phone" aria-invalid={!!errors.phone} {...register("phone")} placeholder="+91 98765 43210" />
            </Field>
            <Field label="Email" htmlFor="email" required error={errors.email?.message}>
              <Input id="email" type="email" aria-invalid={!!errors.email} {...register("email")} placeholder="name@company.in" />
            </Field>
            <Field label="Service" htmlFor="service" required error={errors.service?.message}>
              <Controller
                control={control}
                name="service"
                render={({ field }) => (
                  <ServiceSearch
                    id="service"
                    value={field.value}
                    onChange={field.onChange}
                    onSelectService={(selectedService) => {
                      field.onChange(selectedService.name);
                      setCatalogPrice(selectedService.price);
                      if (selectedService.price > 0) {
                        setValue("monthly_value", selectedService.price, {
                          shouldValidate: true,
                          shouldDirty: true,
                        });
                        toast.info(`Selected ${selectedService.name} (pricing auto-filled)`);
                      }
                    }}
                    error={!!errors.service}
                    placeholder="Search services with pricing…"
                  />
                )}
              />
            </Field>
            <Field label="Monthly Value" htmlFor="monthly_value" required error={errors.monthly_value?.message}>
              <MoneyInput id="monthly_value" aria-invalid={!!errors.monthly_value} {...register("monthly_value", { valueAsNumber: true })} placeholder="0" />
              {catalogPrice !== null && currentMonthlyValue !== catalogPrice && (
                <p className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                  Custom client pricing (standard: {formatCurrency(catalogPrice)}/mo)
                </p>
              )}
            </Field>
            <Field label="Status" htmlFor="status" required error={errors.status?.message}>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="status" aria-invalid={!!errors.status} className="w-full">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Notes" htmlFor="notes" error={errors.notes?.message} className="sm:col-span-2">
              <Textarea id="notes" {...register("notes")} placeholder="Optional notes" rows={3} />
            </Field>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
