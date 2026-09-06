create table if not exists public.opening_balances (
  month        text primary key, -- Format: YYYY-MM
  balance      numeric not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.opening_balances;
create trigger set_updated_at before update on public.opening_balances
  for each row execute function public.set_updated_at();

alter table public.opening_balances enable row level security;
drop policy if exists "balances anon all" on public.opening_balances;
create policy "balances anon all" on public.opening_balances for all to anon using (true) with check (true);

grant all on public.opening_balances to anon;
