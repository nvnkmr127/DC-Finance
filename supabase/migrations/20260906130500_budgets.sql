-- Monthly category budgets (compared against actual expenses in the app).

create table if not exists public.budgets (
  id         uuid primary key default gen_random_uuid(),
  month      text not null,   -- YYYY-MM
  category   text not null,
  amount     numeric not null default 0 check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (month, category)
);

drop trigger if exists set_updated_at on public.budgets;
create trigger set_updated_at before update on public.budgets
  for each row execute function public.set_updated_at();

alter table public.budgets enable row level security;
drop policy if exists "budgets authenticated all" on public.budgets;
create policy "budgets authenticated all" on public.budgets for all to authenticated using (true) with check (true);
grant all on public.budgets to authenticated;
