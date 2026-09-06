"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, MoneyInput } from "@/components/form-field";
import {
  projectSchema,
  createProject,
  updateProject,
  type ProjectInput,
  type ProjectSummary,
} from "@/lib/projects";

const today = () => new Date().toISOString().slice(0, 10);
const INTERNAL = "internal"; // sentinel for the "no client" option

const emptyValues = (): ProjectInput => ({
  name: "",
  client_id: "",
  value: 0,
  status: "active",
  start_date: today(),
  notes: "",
});

export function ProjectForm({
  clients,
  project,
  open,
  onOpenChange,
  onSaved,
  showTrigger = false,
}: {
  clients: { id: string; name: string; company: string }[];
  project?: ProjectSummary;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSaved: () => void;
  showTrigger?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = open !== undefined;
  const isOpen = controlled ? open : internalOpen;
  const setOpen = controlled ? onOpenChange! : setInternalOpen;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProjectInput>({
    resolver: zodResolver(projectSchema),
    defaultValues: emptyValues(),
  });

  useEffect(() => {
    if (!isOpen) return;
    reset(
      project
        ? {
            name: project.name,
            client_id: project.client_id ?? "",
            value: project.value,
            status: project.status,
            start_date: project.start_date,
            notes: project.notes ?? "",
          }
        : emptyValues(),
    );
  }, [isOpen, project, reset]);

  const onSubmit = async (values: ProjectInput) => {
    try {
      if (project) {
        await updateProject(project.id, values);
        toast.success("Project updated");
      } else {
        await createProject(values);
        toast.success("Project created");
      }
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save project");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {showTrigger && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{project ? "Edit Project" : "New Project"}</DialogTitle>
            <DialogDescription>
              Fixed-value project or SaaS product. Payments applied to it show received vs value.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <Field label="Project Name" htmlFor="name" required error={errors.name?.message}>
              <Input id="name" aria-invalid={!!errors.name} {...register("name")} placeholder="e.g. Acme storefront rebuild" />
            </Field>

            <Field label="Client" htmlFor="client_id" error={errors.client_id?.message}>
              <Controller
                control={control}
                name="client_id"
                render={({ field }) => (
                  <Select
                    value={field.value ? field.value : INTERNAL}
                    onValueChange={(v) => field.onChange(v === INTERNAL ? "" : v)}
                  >
                    <SelectTrigger id="client_id" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={INTERNAL}>Internal (no client / own SaaS)</SelectItem>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} · {c.company}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Project Value" htmlFor="value" required error={errors.value?.message}>
                <MoneyInput id="value" aria-invalid={!!errors.value} {...register("value", { valueAsNumber: true })} placeholder="0" />
              </Field>
              <Field label="Start Date" htmlFor="start_date" required error={errors.start_date?.message}>
                <Input id="start_date" type="date" aria-invalid={!!errors.start_date} {...register("start_date")} />
              </Field>
            </div>

            <Field label="Status" htmlFor="status" required error={errors.status?.message}>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="on-hold">On Hold</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field label="Notes" htmlFor="notes" error={errors.notes?.message}>
              <Textarea id="notes" {...register("notes")} placeholder="Optional scope / notes" rows={2} />
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
