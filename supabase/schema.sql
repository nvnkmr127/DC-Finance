-- Digicloudify Finance — database schema
-- Run once in the Supabase SQL editor.

-- ---- Tables --------------------------------------------------------------

create table if not exists public.clients (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  company       text not null,
  phone         text not null,
  email         text not null,
  service       text not null,
  monthly_value numeric not null default 0,
  status        text not null default 'active' check (status in ('active', 'inactive')),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.employees (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  designation  text not null,
  salary       numeric not null default 0,
  joining_date date not null default now(),
  status       text not null default 'active' check (status in ('active', 'inactive')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.payments (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients(id) on delete restrict,
  amount         numeric not null default 0,
  payment_date   date not null default now(),
  payment_method text not null default 'Bank Transfer',
  reference_number text,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.expenses (
  id             uuid primary key default gen_random_uuid(),
  category       text not null default 'Other',
  description    text not null,
  vendor         text,
  amount         numeric not null default 0,
  expense_date   date not null default now(),
  payment_method text not null default 'Bank Transfer',
  recurring      boolean not null default false,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.recurring (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  category          text not null default 'Other',
  vendor            text,
  amount            numeric not null default 0,
  frequency         text not null default 'Monthly'
                    check (frequency in ('Monthly', 'Quarterly', 'Yearly')),
  next_payment_date date not null default now(),
  payment_method    text not null default 'Bank Transfer',
  active            boolean not null default true,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.salary_payments (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.employees(id) on delete cascade,
  amount       numeric not null default 0,
  payment_date date not null default now(),
  bonus        numeric not null default 0,
  deduction    numeric not null default 0,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.opening_balances (
  month        text primary key, -- Format: YYYY-MM
  balance      numeric not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.settings (
  id                     integer primary key check (id = 1),
  company_name           text not null default 'Digicloudify Finance',
  company_logo           text,
  global_opening_balance numeric not null default 0,
  default_currency       text not null default 'INR',
  financial_year_start   text not null default '04-01',
  expense_categories     text[] not null default array['Office', 'Software', 'Advertising', 'Equipment', 'Travel', 'Internet', 'Electricity', 'Freelancers', 'Salary', 'Other'],
  payment_methods        text[] not null default array['Bank Transfer', 'UPI', 'Cash', 'Card', 'Other'],
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ---- updated_at auto-touch ----------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['clients','employees','payments','expenses','recurring','salary_payments','opening_balances','settings']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---- Indexes -------------------------------------------------------------

create index if not exists payments_client_id_idx     on public.payments (client_id);
create index if not exists payments_date_idx          on public.payments (payment_date);
create index if not exists expenses_date_idx          on public.expenses (expense_date);
create index if not exists expenses_category_idx      on public.expenses (category);
create index if not exists recurring_next_date_idx    on public.recurring (next_payment_date);
create index if not exists salary_payments_emp_id_idx on public.salary_payments (employee_id);
create index if not exists salary_payments_date_idx   on public.salary_payments (payment_date);
create index if not exists clients_status_idx         on public.clients (status);

-- ---- Summary view: client fields + payment-derived totals ----------------

create or replace view public.client_summary
with (security_invoker = true) as
select
  c.*,
  coalesce(sum(p.amount), 0)::numeric as total_received,
  greatest(
    c.monthly_value - coalesce(
      sum(p.amount) filter (
        where date_trunc('month', p.payment_date) = date_trunc('month', current_date)
      ), 0),
    0
  )::numeric as outstanding,
  count(p.id) as payment_count
from public.clients c
left join public.payments p on p.client_id = c.id
group by c.id;

-- ---- Access --------------------------------------------------------------
-- Internal tool, no auth yet. Allow the anon / publishable key full access.
-- ponytail: permissive policy — restrict to `authenticated` once auth lands.

alter table public.clients         enable row level security;
alter table public.employees       enable row level security;
alter table public.payments        enable row level security;
alter table public.expenses        enable row level security;
alter table public.recurring       enable row level security;
alter table public.salary_payments enable row level security;
alter table public.opening_balances enable row level security;
alter table public.settings        enable row level security;

drop policy if exists "clients anon all"   on public.clients;
drop policy if exists "employees anon all" on public.employees;
drop policy if exists "payments anon all"  on public.payments;
drop policy if exists "expenses anon all"  on public.expenses;
drop policy if exists "recurring anon all" on public.recurring;
drop policy if exists "salary anon all"    on public.salary_payments;
drop policy if exists "balances anon all"  on public.opening_balances;
drop policy if exists "settings anon all"  on public.settings;
create policy "clients anon all"   on public.clients         for all to anon using (true) with check (true);
create policy "employees anon all" on public.employees       for all to anon using (true) with check (true);
create policy "payments anon all"  on public.payments        for all to anon using (true) with check (true);
create policy "expenses anon all"  on public.expenses        for all to anon using (true) with check (true);
create policy "recurring anon all" on public.recurring       for all to anon using (true) with check (true);
create policy "salary anon all"    on public.salary_payments for all to anon using (true) with check (true);
create policy "balances anon all"  on public.opening_balances for all to anon using (true) with check (true);
create policy "settings anon all"  on public.settings        for all to anon using (true) with check (true);

grant usage on schema public to anon;
grant all on public.clients         to anon;
grant all on public.employees       to anon;
grant all on public.payments        to anon;
grant all on public.expenses        to anon;
grant all on public.recurring       to anon;
grant all on public.salary_payments to anon;
grant all on public.opening_balances to anon;
grant all on public.settings         to anon;
grant select on public.client_summary to anon;

-- ---- Config row (not seed data) ------------------------------------------

insert into public.settings (id) values (1) on conflict do nothing;
