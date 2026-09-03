import { z } from "zod";
import { getSupabase } from "@/lib/supabase/client";

// ---- Employees -----------------------------------------------------------

export const employeeSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  designation: z.string().min(1, "Designation is required").max(120),
  salary: z.number({ error: "Enter a salary" }).min(0, "Must be 0 or more"),
  joining_date: z.string().min(1, "Select the joining date"),
  status: z.enum(["active", "inactive"]),
});

export type EmployeeInput = z.infer<typeof employeeSchema>;
export type Employee = EmployeeInput & { id: string; created_at: string };

export async function listEmployees(): Promise<Employee[]> {
  const { data, error } = await getSupabase()
    .from("employees")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data as Employee[];
}

export async function createEmployee(input: EmployeeInput): Promise<void> {
  const { error } = await getSupabase().from("employees").insert(input);
  if (error) throw new Error(error.message);
}

export async function updateEmployee(id: string, input: EmployeeInput): Promise<void> {
  const { error } = await getSupabase().from("employees").update(input).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteEmployee(id: string): Promise<void> {
  const { error } = await getSupabase().from("employees").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setEmployeeActive(id: string, active: boolean): Promise<void> {
  const { error } = await getSupabase()
    .from("employees")
    .update({ status: active ? "active" : "inactive" })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ---- Salary payments -----------------------------------------------------

export const salaryPaymentSchema = z.object({
  employee_id: z.string().min(1, "Select an employee"),
  amount: z.number({ error: "Enter an amount" }).positive("Must be greater than 0"),
  payment_date: z.string().min(1, "Select a payment date"),
  bonus: z.number({ error: "Enter a number" }).min(0, "Must be 0 or more"),
  deduction: z.number({ error: "Enter a number" }).min(0, "Must be 0 or more"),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export type SalaryPaymentInput = z.infer<typeof salaryPaymentSchema>;

export type SalaryPayment = {
  id: string;
  employee_id: string;
  amount: number;
  bonus: number;
  deduction: number;
  payment_date: string;
  notes: string | null;
  created_at: string;
  employees: { name: string; designation: string } | null;
};

// Net salary = amount + bonus - deduction.
export function netSalary(p: {
  amount: number;
  bonus: number;
  deduction: number;
}): number {
  return p.amount + p.bonus - p.deduction;
}

export async function listSalaryPayments(): Promise<SalaryPayment[]> {
  const { data, error } = await getSupabase()
    .from("salary_payments")
    .select("*, employees(name, designation)")
    .order("payment_date", { ascending: false });
  if (error) throw new Error(error.message);
  return data as unknown as SalaryPayment[];
}

export async function createSalaryPayment(input: SalaryPaymentInput): Promise<void> {
  const { error } = await getSupabase().from("salary_payments").insert(input);
  if (error) throw new Error(error.message);
}

export async function updateSalaryPayment(id: string, input: SalaryPaymentInput): Promise<void> {
  const { error } = await getSupabase().from("salary_payments").update(input).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteSalaryPayment(id: string): Promise<void> {
  const { error } = await getSupabase().from("salary_payments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
