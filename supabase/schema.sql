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
  payment_method text not null default 'Bank Transfer'
                 check (payment_method in ('Bank Transfer', 'UPI', 'Cash', 'Card', 'Other')),
  reference_number text,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.expenses (
  id             uuid primary key default gen_random_uuid(),
  category       text not null default 'Other'
                 check (category in ('Office', 'Software', 'Advertising', 'Equipment',
                                     'Travel', 'Internet', 'Electricity', 'Freelancers', 'Salary', 'Other')),
  description    text not null,
  vendor         text,
  amount         numeric not null default 0,
  expense_date   date not null default now(),
  payment_method text not null default 'Bank Transfer'
                 check (payment_method in ('Bank Transfer', 'UPI', 'Cash', 'Card', 'Other')),
  recurring      boolean not null default false,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.recurring (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  category          text not null default 'Other'
                    check (category in ('Office', 'Software', 'Advertising', 'Equipment',
                                        'Travel', 'Internet', 'Electricity', 'Freelancers', 'Salary', 'Other')),
  vendor            text,
  amount            numeric not null default 0,
  frequency         text not null default 'Monthly'
                    check (frequency in ('Monthly', 'Quarterly', 'Yearly')),
  next_payment_date date not null default now(),
  payment_method    text not null default 'Bank Transfer'
                    check (payment_method in ('Bank Transfer', 'UPI', 'Cash', 'Card', 'Other')),
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
  foreach t in array array['clients','employees','payments','expenses','recurring','salary_payments']
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

drop policy if exists "clients anon all"   on public.clients;
drop policy if exists "employees anon all" on public.employees;
drop policy if exists "payments anon all"  on public.payments;
drop policy if exists "expenses anon all"  on public.expenses;
drop policy if exists "recurring anon all" on public.recurring;
drop policy if exists "salary anon all"    on public.salary_payments;
create policy "clients anon all"   on public.clients         for all to anon using (true) with check (true);
create policy "employees anon all" on public.employees       for all to anon using (true) with check (true);
create policy "payments anon all"  on public.payments        for all to anon using (true) with check (true);
create policy "expenses anon all"  on public.expenses        for all to anon using (true) with check (true);
create policy "recurring anon all" on public.recurring       for all to anon using (true) with check (true);
create policy "salary anon all"    on public.salary_payments for all to anon using (true) with check (true);

grant usage on schema public to anon;
grant all on public.clients         to anon;
grant all on public.employees       to anon;
grant all on public.payments        to anon;
grant all on public.expenses        to anon;
grant all on public.recurring       to anon;
grant all on public.salary_payments to anon;
grant select on public.client_summary to anon;

-- ---- Seed data -----------------------------------------------------------

insert into public.clients (name, company, phone, email, service, monthly_value, status, notes) values
  ('Aarav Mehta',  'Aarav Retail Pvt Ltd', '+91 98200 11223', 'aarav@aaravretail.in', 'Cloud Hosting',       125000, 'active',   'Key account — quarterly review.'),
  ('Priya Nair',   'Nimbus Softworks',     '+91 99400 55667', 'priya@nimbussoft.com', 'Managed DevOps',       89000, 'active',   null),
  ('Rohan Gupta',  'Sunrise Logistics',    '+91 90080 33445', 'rohan@sunriselog.in',  'Fleet Tracking SaaS', 210000, 'active',   'Largest account.'),
  ('Divya Rao',    'Kaveri Textiles',      '+91 94440 77889', 'divya@kaveritex.in',   'Website + SEO',        56000, 'inactive', 'Contract on hold.'),
  ('Karan Shah',   'BlueOrbit Media',      '+91 98330 22110', 'karan@blueorbit.co',   'Ad Analytics',        147000, 'active',   null),
  ('Sneha Iyer',   'Green Valley Foods',   '+91 91020 66554', 'sneha@greenvalley.in', 'E-commerce Store',     73000, 'active',   null)
on conflict do nothing;

insert into public.payments (client_id, amount, payment_date, payment_method, notes)
select id, v.amount, v.payment_date::date, v.payment_method, v.notes
from (values
  ('rohan@sunriselog.in',  410000, '2026-07-30', 'Bank Transfer', 'July retainer'),
  ('rohan@sunriselog.in',  200000, '2026-09-01', 'Bank Transfer', 'Part payment'),
  ('karan@blueorbit.co',   275000, '2026-08-24', 'UPI',           null),
  ('karan@blueorbit.co',   150000, '2026-09-02', 'UPI',           'September retainer'),
  ('aarav@aaravretail.in', 125000, '2026-09-01', 'UPI',           'September retainer'),
  ('priya@nimbussoft.com', 210000, '2026-08-18', 'UPI',           null),
  ('priya@nimbussoft.com',  89000, '2026-09-02', 'Card',          'September retainer'),
  ('sneha@greenvalley.in',  73000, '2026-06-10', 'Cash',          'Q2 settlement')
) as v(email, amount, payment_date, payment_method, notes)
join public.clients c on c.email = v.email
on conflict do nothing;

insert into public.expenses (category, description, amount, expense_date, payment_method, recurring, notes) values
  ('Software',    'AWS cloud hosting',       148000, '2026-09-01', 'Card',          true,  'Monthly infra'),
  ('Office',      'WeWork office rent',      220000, '2026-09-01', 'Bank Transfer', true,  null),
  ('Software',    'Zoho One subscription',    34000, '2026-09-02', 'Card',          true,  null),
  ('Internet',    'Airtel leased line',       18500, '2026-09-03', 'UPI',           true,  null),
  ('Advertising', 'Google Ads campaign',      96000, '2026-08-15', 'Card',          false, 'Q3 push'),
  ('Freelancers', 'Contract designer',        60000, '2026-08-20', 'UPI',           false, 'Landing page'),
  ('Travel',      'Client visit — Mumbai',    27600, '2026-08-06', 'UPI',           false, null),
  ('Electricity', 'Office electricity bill',  14200, '2026-07-28', 'UPI',           true,  null)
on conflict do nothing;

insert into public.recurring (name, category, amount, frequency, next_payment_date, active, notes) values
  ('AWS Cloud Hosting',    'Software',    148000, 'Monthly',   '2026-09-06', true,  'Auto-debit'),
  ('WeWork Office Rent',   'Office',      220000, 'Monthly',   '2026-09-05', true,  null),
  ('Zoho One',             'Software',     34000, 'Monthly',   '2026-09-10', true,  null),
  ('Airtel Leased Line',   'Internet',     18500, 'Monthly',   '2026-09-18', true,  null),
  ('Statutory Audit',      'Freelancers',  90000, 'Yearly',    '2027-03-31', true,  'Annual compliance'),
  ('GST Filing Retainer',  'Freelancers',  45000, 'Quarterly', '2026-10-07', true,  null),
  ('Figma Org',            'Software',     15000, 'Monthly',   '2026-09-15', false, 'Paused')
on conflict do nothing;

insert into public.employees (name, designation, salary, joining_date, status) values
  ('Vikram Sethi',    'Engineering Lead',   210000, '2023-04-10', 'active'),
  ('Ananya Krishnan', 'Senior Developer',   165000, '2023-09-01', 'active'),
  ('Rahul Deshmukh',  'Product Designer',   140000, '2024-01-15', 'active'),
  ('Meera Pillai',    'Account Manager',    120000, '2024-06-01', 'active'),
  ('Arjun Reddy',     'DevOps Engineer',    155000, '2024-08-20', 'active'),
  ('Sara Thomas',     'Finance Executive',   95000, '2025-02-11', 'active')
on conflict do nothing;

insert into public.salary_payments (employee_id, amount, payment_date, bonus, deduction, notes)
select id, v.amount, v.payment_date::date, v.bonus, v.deduction, v.notes
from (values
  ('Vikram Sethi',    210000, '2026-08-31', 20000, 5000, 'August payroll'),
  ('Ananya Krishnan', 165000, '2026-08-31', 0,     0,    'August payroll'),
  ('Rahul Deshmukh',  140000, '2026-08-31', 0,     2000, 'August payroll'),
  ('Arjun Reddy',     155000, '2026-08-31', 10000, 0,    'August payroll'),
  ('Vikram Sethi',    210000, '2026-09-01', 0,     5000, 'September payroll')
) as v(name, amount, payment_date, bonus, deduction, notes)
join public.employees e on e.name = v.name
on conflict do nothing;
