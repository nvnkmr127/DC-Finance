import { getSupabase } from "@/lib/supabase/client";
import { listClients, monthlyEquivalent, ClientSummary } from "@/lib/clients";
import { listRecurring } from "@/lib/recurring";

export type MonthlyProjection = {
  month: string; // "YYYY-MM"
  monthLabel: string; // e.g. "Oct 2026"
  startingBalance: number;
  expectedInflow: number;
  expectedSalaries: number;
  expectedRecurringExpenses: number;
  totalOutflow: number;
  netCashFlow: number;
  endingBalance: number;
  status: "healthy" | "warning" | "critical";
};

export type RetainerAlert = {
  client: ClientSummary;
  daysRemaining: number;
  status: "expired" | "critical" | "warning" | "upcoming";
};

export async function getPredictiveRunway(monthsCount = 3): Promise<{
  projections: MonthlyProjection[];
  currentBalance: number;
  totalMonthlyMRR: number;
  totalMonthlyBurn: number;
  netMonthlyCashFlow: number;
  estimatedRunwayMonths: number;
}> {
  const supabase = getSupabase();

  // 1. Fetch active clients
  const clients = await listClients();
  const activeClients = clients.filter((c) => c.status === "active");
  const totalMonthlyMRR = activeClients.reduce(
    (sum, c) => sum + monthlyEquivalent(c),
    0
  );

  // 2. Fetch active employees (salaries)
  const { data: employees, error: empErr } = await supabase
    .from("employees")
    .select("salary")
    .eq("status", "active");

  if (empErr) throw new Error(empErr.message);
  const totalMonthlySalaries = (employees || []).reduce(
    (sum, e) => sum + (Number(e.salary) || 0),
    0
  );

  // 3. Fetch active recurring bills
  const recurringList = await listRecurring();
  const activeRecurring = recurringList.filter((r) => r.active);
  const totalMonthlyRecurring = activeRecurring.reduce((sum, r) => {
    const amt = Number(r.amount) || 0;
    if (r.frequency === "Quarterly") return sum + amt / 3;
    if (r.frequency === "Yearly") return sum + amt / 12;
    return sum + amt;
  }, 0);

  const totalMonthlyBurn = totalMonthlySalaries + totalMonthlyRecurring;
  const netMonthlyCashFlow = totalMonthlyMRR - totalMonthlyBurn;

  // 4. Determine current starting cash balance
  // Fetch recent payments and expenses to compute running cash
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const { data: openBal } = await supabase
    .from("opening_balances")
    .select("balance")
    .eq("month", currentMonthStr)
    .maybeSingle();

  const startingCash = Number(openBal?.balance ?? 0);

  // 5. Build month-by-month projections
  let runningBalance = startingCash;
  const projections: MonthlyProjection[] = [];

  for (let i = 1; i <= monthsCount; i++) {
    const projDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthStr = `${projDate.getFullYear()}-${String(projDate.getMonth() + 1).padStart(2, "0")}`;
    const monthLabel = projDate.toLocaleDateString("en-IN", {
      month: "short",
      year: "numeric",
    });

    const expectedInflow = totalMonthlyMRR;
    const expectedSalaries = totalMonthlySalaries;
    const expectedRecurringExpenses = totalMonthlyRecurring;
    const totalOutflow = expectedSalaries + expectedRecurringExpenses;
    const netCashFlow = expectedInflow - totalOutflow;
    const endingBalance = runningBalance + netCashFlow;

    let status: "healthy" | "warning" | "critical" = "healthy";
    if (endingBalance < 0) {
      status = "critical";
    } else if (endingBalance < totalOutflow) {
      status = "warning";
    }

    projections.push({
      month: monthStr,
      monthLabel,
      startingBalance: runningBalance,
      expectedInflow,
      expectedSalaries,
      expectedRecurringExpenses,
      totalOutflow,
      netCashFlow,
      endingBalance,
      status,
    });

    runningBalance = endingBalance;
  }

  const estimatedRunwayMonths =
    totalMonthlyBurn > 0
      ? Math.max(0, Math.round((startingCash / totalMonthlyBurn) * 10) / 10)
      : 99;

  return {
    projections,
    currentBalance: startingCash,
    totalMonthlyMRR,
    totalMonthlyBurn,
    netMonthlyCashFlow,
    estimatedRunwayMonths,
  };
}

export async function getRetainerRenewalAlerts(horizonDays = 60): Promise<RetainerAlert[]> {
  const clients = await listClients();
  const activeClients = clients.filter((c) => c.status === "active" && c.contract_end_date);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const alerts: RetainerAlert[] = [];

  for (const client of activeClients) {
    if (!client.contract_end_date) continue;
    const endDate = new Date(client.contract_end_date);
    endDate.setHours(0, 0, 0, 0);

    const diffTime = endDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysRemaining <= horizonDays) {
      let status: "expired" | "critical" | "warning" | "upcoming" = "upcoming";
      if (daysRemaining < 0) {
        status = "expired";
      } else if (daysRemaining <= 15) {
        status = "critical";
      } else if (daysRemaining <= 45) {
        status = "warning";
      }

      alerts.push({
        client,
        daysRemaining,
        status,
      });
    }
  }

  return alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);
}
