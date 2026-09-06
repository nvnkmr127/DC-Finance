-- Clients don't all bill monthly: some pay quarterly, some by commission when a
-- sale happens. `monthly_value` now means "amount charged per billing cycle";
-- reporting amortizes it to a monthly-equivalent (quarterly ÷ 3, commission
-- excluded) so MRR / expected-revenue stay honest.
--
-- A CHECK is used here (unlike services.unit) because this value drives revenue
-- math, not just a label — a bad cycle would silently corrupt the amortization.
-- Existing rows default to 'monthly', preserving today's behavior exactly.

alter table public.clients
  add column if not exists billing_cycle text not null default 'monthly';

do $$
begin
  alter table public.clients
    add constraint clients_billing_cycle_check
    check (billing_cycle in ('monthly', 'quarterly', 'commission'));
exception when duplicate_object then null;
end $$;
