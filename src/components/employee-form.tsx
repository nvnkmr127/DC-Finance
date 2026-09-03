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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, MoneyInput } from "@/components/form-field";
import {
  employeeSchema,
  createEmployee,
  updateEmployee,
  type EmployeeInput,
  type Employee,
} from "@/lib/salaries";

const today = () => new Date().toISOString().slice(0, 10);

const empty: EmployeeInput = {
  name: "",
  designation: "",
  salary: 0,
  joining_date: today(),
  status: "active",
};

export function EmployeeForm({
  employee,
  open,
  onOpenChange,
  onSaved,
  showTrigger = false,
}: {
  employee?: Employee;
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
  } = useForm<EmployeeInput>({
    resolver: zodResolver(employeeSchema),
    defaultValues: empty,
  });

  useEffect(() => {
    if (isOpen) reset(employee ? { ...employee } : empty);
  }, [isOpen, employee, reset]);

  const onSubmit = async (values: EmployeeInput) => {
    try {
      if (employee) {
        await updateEmployee(employee.id, values);
        toast.success("Employee updated");
      } else {
        await createEmployee(values);
        toast.success("Employee added");
      }
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save employee");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {showTrigger && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4" />
            Add Employee
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{employee ? "Edit Employee" : "Add Employee"}</DialogTitle>
            <DialogDescription>
              {employee ? "Update this employee." : "Add a new employee."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <Field label="Name" htmlFor="name" required error={errors.name?.message}>
              <Input id="name" aria-invalid={!!errors.name} {...register("name")} placeholder="Full name" />
            </Field>
            <Field label="Designation" htmlFor="designation" required error={errors.designation?.message}>
              <Input id="designation" aria-invalid={!!errors.designation} {...register("designation")} placeholder="e.g. Senior Developer" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Monthly Salary" htmlFor="salary" required error={errors.salary?.message}>
                <MoneyInput id="salary" aria-invalid={!!errors.salary} {...register("salary", { valueAsNumber: true })} placeholder="0" />
              </Field>
              <Field label="Joining Date" htmlFor="joining_date" required error={errors.joining_date?.message}>
                <Input id="joining_date" type="date" aria-invalid={!!errors.joining_date} {...register("joining_date")} />
              </Field>
            </div>
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
