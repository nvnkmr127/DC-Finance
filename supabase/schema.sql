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
  receipt_path   text,
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
  receipt_path text,
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
  email_reminders_enabled boolean not null default false,
  reminder_from_email    text,
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

-- ---- Money guards --------------------------------------------------------
-- Defense in depth: the client-side zod schemas validate amounts, but a direct
-- API call could bypass them. Reject negative money at the database too.

do $$
begin
  begin alter table public.payments        add constraint payments_amount_nonneg   check (amount >= 0); exception when duplicate_object then null; end;
  begin alter table public.expenses        add constraint expenses_amount_nonneg   check (amount >= 0); exception when duplicate_object then null; end;
  begin alter table public.recurring       add constraint recurring_amount_nonneg  check (amount >= 0); exception when duplicate_object then null; end;
  begin alter table public.salary_payments add constraint salary_amount_nonneg     check (amount >= 0 and bonus >= 0 and deduction >= 0); exception when duplicate_object then null; end;
end $$;

-- ---- Atomic recurring payment --------------------------------------------
-- Books a recurring template's expense AND advances its next date in one
-- transaction, so a partial failure can't lead to a double-recorded charge.

create or replace function public.record_recurring_payment(
  p_recurring_id uuid,
  p_expense_date date
) returns date
language plpgsql
security invoker
as $$
declare
  r public.recurring;
  v_months int;
  v_next date;
begin
  select * into r from public.recurring where id = p_recurring_id for update;
  if not found then
    raise exception 'Recurring template % not found', p_recurring_id;
  end if;

  insert into public.expenses (
    category, description, vendor, amount, expense_date,
    payment_method, recurring, notes
  )
  values (
    r.category, r.name, coalesce(r.vendor, ''), r.amount, p_expense_date,
    coalesce(r.payment_method, 'Bank Transfer'), true,
    case
      when coalesce(r.notes, '') <> '' then '[Recurring: ' || r.frequency || '] ' || r.notes
      else '[Recurring: ' || r.frequency || ']'
    end
  );

  v_months := case r.frequency when 'Monthly' then 1 when 'Quarterly' then 3 else 12 end;
  v_next := (r.next_payment_date + (v_months || ' months')::interval)::date;
  update public.recurring set next_payment_date = v_next where id = r.id;
  return v_next;
end;
$$;

-- ---- Access --------------------------------------------------------------
-- Signed-in users only. The anon/publishable key can no longer touch data;
-- a valid Supabase Auth session is required for every query. Create at least
-- one user (dashboard → Authentication → Users) so someone can sign in.

alter table public.clients         enable row level security;
alter table public.employees       enable row level security;
alter table public.payments        enable row level security;
alter table public.expenses        enable row level security;
alter table public.recurring       enable row level security;
alter table public.salary_payments enable row level security;
alter table public.opening_balances enable row level security;
alter table public.settings        enable row level security;

drop policy if exists "clients authenticated all"   on public.clients;
drop policy if exists "employees authenticated all" on public.employees;
drop policy if exists "payments authenticated all"  on public.payments;
drop policy if exists "expenses authenticated all"  on public.expenses;
drop policy if exists "recurring authenticated all" on public.recurring;
drop policy if exists "salary_payments authenticated all" on public.salary_payments;
drop policy if exists "opening_balances authenticated all" on public.opening_balances;
drop policy if exists "settings authenticated all"  on public.settings;
create policy "clients authenticated all"   on public.clients         for all to authenticated using (true) with check (true);
create policy "employees authenticated all" on public.employees       for all to authenticated using (true) with check (true);
create policy "payments authenticated all"  on public.payments        for all to authenticated using (true) with check (true);
create policy "expenses authenticated all"  on public.expenses        for all to authenticated using (true) with check (true);
create policy "recurring authenticated all" on public.recurring       for all to authenticated using (true) with check (true);
create policy "salary_payments authenticated all" on public.salary_payments for all to authenticated using (true) with check (true);
create policy "opening_balances authenticated all" on public.opening_balances for all to authenticated using (true) with check (true);
create policy "settings authenticated all"  on public.settings        for all to authenticated using (true) with check (true);

grant usage on schema public to authenticated;
grant all on public.clients         to authenticated;
grant all on public.employees       to authenticated;
grant all on public.payments        to authenticated;
grant all on public.expenses        to authenticated;
grant all on public.recurring       to authenticated;
grant all on public.salary_payments to authenticated;
grant all on public.opening_balances to authenticated;
grant all on public.settings         to authenticated;
grant select on public.client_summary to authenticated;
grant execute on function public.record_recurring_payment(uuid, date) to authenticated;

-- ---- Invoicing -----------------------------------------------------------
-- Invoices + line items; client payments can link to an invoice so outstanding
-- is invoiced − paid. No tax.

create table if not exists public.invoices (
  id             uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  client_id      uuid not null references public.clients(id) on delete restrict,
  issue_date     date not null default now(),
  due_date       date not null default now(),
  status         text not null default 'draft' check (status in ('draft', 'sent', 'cancelled')),
  notes          text,
  total          numeric not null default 0 check (total >= 0),
  last_reminded_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.invoice_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity    numeric not null default 1 check (quantity >= 0),
  unit_price  numeric not null default 0 check (unit_price >= 0),
  amount      numeric not null default 0 check (amount >= 0)
);

alter table public.payments
  add column if not exists invoice_id uuid references public.invoices(id) on delete set null;

create index if not exists invoices_client_id_idx       on public.invoices (client_id);
create index if not exists invoices_status_idx          on public.invoices (status);
create index if not exists invoices_issue_date_idx      on public.invoices (issue_date);
create index if not exists invoice_items_invoice_id_idx on public.invoice_items (invoice_id);
create index if not exists payments_invoice_id_idx      on public.payments (invoice_id);

drop trigger if exists set_updated_at on public.invoices;
create trigger set_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();

create or replace view public.invoice_summary
with (security_invoker = true) as
select
  i.*,
  c.name    as client_name,
  c.company as client_company,
  coalesce(sum(p.amount), 0)::numeric as paid,
  greatest(i.total - coalesce(sum(p.amount), 0), 0)::numeric as balance,
  case
    when i.status = 'cancelled' then 'cancelled'
    when i.total > 0 and coalesce(sum(p.amount), 0) >= i.total then 'paid'
    when coalesce(sum(p.amount), 0) > 0 then 'partial'
    else i.status
  end as display_status
from public.invoices i
join public.clients c on c.id = i.client_id
left join public.payments p on p.invoice_id = i.id
group by i.id, c.name, c.company;

alter table public.invoices      enable row level security;
alter table public.invoice_items enable row level security;
drop policy if exists "invoices authenticated all"      on public.invoices;
drop policy if exists "invoice_items authenticated all" on public.invoice_items;
create policy "invoices authenticated all"      on public.invoices      for all to authenticated using (true) with check (true);
create policy "invoice_items authenticated all" on public.invoice_items for all to authenticated using (true) with check (true);
grant all on public.invoices      to authenticated;
grant all on public.invoice_items to authenticated;
grant select on public.invoice_summary to authenticated;

-- ---- Receipts storage ----------------------------------------------------
-- Private bucket for expense / salary receipt attachments (signed-URL access).

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists "receipts read"   on storage.objects;
drop policy if exists "receipts insert" on storage.objects;
drop policy if exists "receipts update" on storage.objects;
drop policy if exists "receipts delete" on storage.objects;
create policy "receipts read"   on storage.objects for select to authenticated using (bucket_id = 'receipts');
create policy "receipts insert" on storage.objects for insert to authenticated with check (bucket_id = 'receipts');
create policy "receipts update" on storage.objects for update to authenticated using (bucket_id = 'receipts');
create policy "receipts delete" on storage.objects for delete to authenticated using (bucket_id = 'receipts');

-- ---- Config row (not seed data) ------------------------------------------

insert into public.settings (id) values (1) on conflict do nothing;
