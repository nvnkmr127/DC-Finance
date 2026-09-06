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
  monthly_value numeric not null default 0,  -- amount per billing cycle (see billing_cycle)
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'quarterly', 'commission')),
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

-- ---- Audit trail ---------------------------------------------------------
-- Append-only log of all changes. SECURITY DEFINER trigger writes it; users get
-- SELECT only, so entries can't be forged or deleted from the app.

create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  table_name text not null,
  row_id     text,
  action     text not null,
  actor      text,
  old_data   jsonb,
  new_data   jsonb,
  changed_at timestamptz not null default now()
);
create index if not exists audit_log_changed_at_idx on public.audit_log (changed_at desc);
create index if not exists audit_log_table_idx       on public.audit_log (table_name);

create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_old jsonb; v_new jsonb;
begin
  if tg_op <> 'INSERT' then v_old := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_new := to_jsonb(new); end if;
  insert into public.audit_log (table_name, row_id, action, actor, old_data, new_data)
  values (
    tg_table_name,
    coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'month', v_old ->> 'month'),
    tg_op,
    coalesce(auth.jwt() ->> 'email', auth.uid()::text),
    v_old, v_new
  );
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'clients','employees','payments','expenses','recurring',
    'salary_payments','invoices','opening_balances','settings'
  ]
  loop
    execute format('drop trigger if exists audit on public.%I', t);
    execute format(
      'create trigger audit after insert or update or delete on public.%I
         for each row execute function public.audit_trigger()', t);
  end loop;
end $$;

alter table public.audit_log enable row level security;
drop policy if exists "audit_log read" on public.audit_log;
create policy "audit_log read" on public.audit_log for select to authenticated using (true);
grant select on public.audit_log to authenticated;

-- ---- Budgets -------------------------------------------------------------
-- Monthly per-category budgets, compared against actual expenses in the app.

create table if not exists public.budgets (
  id         uuid primary key default gen_random_uuid(),
  month      text not null,
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

-- ---- Services & Pricing --------------------------------------------------

create table if not exists public.services (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  price       numeric not null default 0 check (price >= 0),
  unit        text not null default 'month',  -- pricing basis: month, day, one-time, each, per-1000-words, scoped, …
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists set_updated_at on public.services;
create trigger set_updated_at before update on public.services
  for each row execute function public.set_updated_at();
alter table public.services enable row level security;
drop policy if exists "services authenticated all" on public.services;
create policy "services authenticated all" on public.services for all to authenticated using (true) with check (true);
grant all on public.services to authenticated;

insert into public.services (name, price, description) values
  ('Cloud Hosting & Infrastructure', 15000, 'Managed cloud servers & monitoring'),
  ('Web Application Development', 45000, 'Custom full-stack web development'),
  ('SEO & Performance Optimization', 20000, 'Monthly SEO audits and speed optimization'),
  ('DevOps & CI/CD Pipelines', 35000, 'Automated deployment pipelines and Docker setup'),
  ('IT Support & Maintenance', 25000, 'Ongoing technical support and bug fixes'),
  ('Mobile App Maintenance', 30000, 'iOS and Android updates & maintenance')
on conflict (name) do nothing;

-- DigiCloudify Sales Partner rate card (GST-exclusive; range start stored in
-- price, full range/unit/scope in description; scoped items seeded at 0).
insert into public.services (name, price, description) values
  ('Technical SEO Audit',            6000,  'One-time · ₹6,000–10,000 · Full crawl, speed, indexing, fixes report'),
  ('On-page SEO',                    7000,  'Per month · Meta, headings, internal links, content optimization'),
  ('Off-page / Link Building',       8000,  'Per month · Outreach, guest posts, citations (backlink budget excluded)'),
  ('Local SEO / GBP',                7000,  'Per month · Profile optimization, citations, reviews, map-pack'),
  ('E-commerce SEO',                 14000, 'Per month · Category + product optimization, schema'),
  ('AI / GEO Search',                9000,  'Per month · AI Overviews, ChatGPT, Perplexity optimization'),
  ('Full SEO Retainer',              16000, 'Per month · Technical + on-page + off-page + 4 blogs/mo + reporting'),
  ('Keyword Research',               4000,  'One-time · Full keyword map, intent, competitors'),
  ('Schema Markup',                  3000,  'One-time · ₹3,000–6,000 · Structured data implementation'),
  ('Social — Lite',                  6000,  'Per month · 1 platform, 12 posts, scheduling + captions'),
  ('Social — Standard',              12000, 'Per month · 2 platforms, creatives + captions + scheduling, 15 posts'),
  ('Social — Premium',               20000, 'Per month · 3+ platforms, creatives + reels + captions + community'),
  ('Community Management',           6000,  'Per month · Comment + DM response, engagement'),
  ('Influencer Marketing',           10000, 'Per month + influencer fees · Sourcing, outreach, coordination, reporting'),
  ('LinkedIn Management',            9000,  'Per month · Personal / company page content + growth'),
  ('Meta Ads — Management',          9000,  'Per month · Setup, targeting, optimization, report (creatives given)'),
  ('Meta Ads — Management + Creatives', 13000, 'Per month · Management + ad creatives (ad spend excluded)'),
  ('Google Ads — Search / PMax',     10000, 'Per month · Setup, keywords, optimization, report (ad spend excluded)'),
  ('Google Ads — Full Managed',      16000, 'Per month · Search + Display + YouTube + Shopping (ad spend excluded)'),
  ('LinkedIn Ads',                   11000, 'Per month · Setup + management + report (ad spend excluded)'),
  ('YouTube Ads',                    9000,  'Per month · Setup + management (ad spend excluded)'),
  ('Full-Funnel Performance',        15000, 'Per month · ≤₹1L spend=₹15k, ₹1–5L=₹28k, ₹5L+=10–12% · Meta+Google, retargeting, tracking, dashboard'),
  ('Funnel / Landing-Page Setup',    18000, 'One-time · ₹18,000–35,000 · Landing page + pixel + tracking + campaign setup'),
  ('Conversion Tracking Setup',      8000,  'One-time · ₹8,000–12,000 · Pixel, GTM, events, GA4'),
  ('CRO / A-B Testing',              12000, 'Per month · Hypotheses, test setup, analysis'),
  ('Email Marketing',                7000,  'Per month · Campaign design + send + report (up to 4/mo)'),
  ('Email Automation Setup',         12000, 'One-time · ₹12,000–22,000 · Welcome / drip / cart-recovery flows'),
  ('SMS Marketing',                  5000,  'Per month + gateway cost · Campaign setup + send + report'),
  ('WhatsApp Marketing',             6000,  'Per month + API cost · Broadcasts, chatbot flows, catalogue (via Watxio)'),
  ('Chatbot Setup',                  10000, 'One-time · ₹10,000–18,000 · Flow design + deployment, WhatsApp or web'),
  ('Review Management',              7000,  'Per month · Monitoring + response + review-generation strategy'),
  ('Reputation Monitoring',          6000,  'Per month · Brand-mention tracking + monthly report'),
  ('Negative-Content Suppression',   0,     'Scoped — quoted per requirement · SEO push-down strategy'),
  ('Marketing Strategy / Consulting', 15000, 'Per month · Audit + roadmap + monthly review'),
  ('Growth Audit',                   8000,  'One-time · Website + social + SEO + ads audit + report'),
  ('Competitor Analysis',            6000,  'One-time · 3–5 competitors, positioning, gaps'),
  ('Analytics Setup',                7000,  'One-time · GA4 + GTM + dashboards'),
  ('Blog — Write Only',              800,   'Per 1,000 words · On given topic (images, publishing excluded)'),
  ('Blog — Research + SEO',          1500,  'Per 1,000 words · Research, writing, SEO format, 1 image'),
  ('Website Copywriting',            1000,  'Per page · Up to 400 words'),
  ('Ad Copy',                        700,   'Per set · 5 variations'),
  ('Product Descriptions',           100,   'Per product · ₹100–250 · SEO-formatted'),
  ('Email Copy',                     600,   'Per email'),
  ('Scriptwriting',                  800,   'Per script · ₹800–2,000 · Video / reel'),
  ('Social Creative — Static',       300,   'Each · ₹300–500 · 1 designed post'),
  ('Social Creative — Animated',     900,   'Each · 1 animated post'),
  ('Poster / Brochure',              600,   'Each · ₹600–1,200 · Print-ready design (printing excluded)'),
  ('Logo Only',                      6000,  'One-time · 3 concepts, 2 revisions, final files'),
  ('Full Brand Identity',            15000, 'One-time · Logo + guidelines + basic collateral'),
  ('Packaging Design',               6000,  'Per SKU · from ₹6,000 (dielines / printing excluded)'),
  ('Pitch / Presentation Deck',      6000,  'One-time · ₹6,000–12,000 · Up to 15 slides'),
  ('Infographic',                    1200,  'Each · ₹1,200–2,500 · Custom designed'),
  ('Product / Studio Shoot',         6000,  'Per day · ₹6,000–15,000 · Jewellery, e-commerce, products'),
  ('Interior / Walkthrough Shoot',   10000, 'Per day · ₹10,000–20,000 · Interior design, real estate'),
  ('Corporate / Interview Shoot',    8000,  'Per day · ₹8,000–16,000 · B2B, education'),
  ('Event Coverage Shoot',           12000, 'Per day · ₹12,000–25,000 · Launches, conferences'),
  ('Food Shoot',                     8000,  'Per day · ₹8,000–16,000 · Hospitality, restaurants'),
  ('Model / Fashion Shoot',          15000, 'Per day + talent · from ₹15,000 · Jewellery, apparel'),
  ('Ad Film / Commercial',           40000, 'Per project · from ₹40,000 · Premium brand ads'),
  ('Short-Form / Reel Shoot',        5000,  'Per session · ₹5,000–10,000 · Social content'),
  ('Reel / Short Edit',              800,   'Per reel · ₹800–1,800 · Cut, captions, music, 1 revision'),
  ('Long-Form Edit',                 2500,  'Per video · ₹2,500–6,000 · ~10 min, cuts, basic graphics'),
  ('Color Grading',                  1200,  'Per video · from ₹1,200 · Professional grade'),
  ('Motion Graphics',                1500,  'Per minute · from ₹1,500 · Animated segments, explainers'),
  ('2D / 3D Animation',              6000,  'Per minute · from ₹6,000 (scoped) · Custom animated video'),
  ('Explainer Video',                12000, 'from ₹12,000 · Script + animation + VO, up to 60s'),
  ('Subtitles / Captions',           400,   'Per video · Timed captions, 1 language'),
  ('Podcast Episode Edit',           2000,  'Per episode · from ₹2,000 · Multi-cam sync, cuts, short clips'),
  ('Product Photography',            250,   'Per product · ₹250–500 · Studio'),
  ('Corporate / Headshots',          6000,  'Per half-day'),
  ('Event Photography',              10000, 'Per day · ₹10,000–18,000'),
  ('Real Estate / Interior Photography', 5000, 'Per property · ₹5,000–10,000'),
  ('Photo Retouching',               80,    'Per image · ₹80–250'),
  ('AI Product Images',              120,   'Per image · ₹120–350 · E-commerce / jewellery visuals'),
  ('AI Product Photography',         150,   'Per image · ₹150–400 · Background / model swap per SKU'),
  ('AI Ad Creatives',                250,   'Each · ₹250–500 · Static ad visuals'),
  ('AI UGC / Avatar Video',          1200,  'Per video · ₹1,200–3,000 · Faceless or avatar short video'),
  ('AI Product Video',               1500,  'Per video · from ₹1,500 · Animated product showcase'),
  ('AI Voiceover',                   250,   'Per minute · ₹250–500 · Natural voice'),
  ('AI Content / Copy',              400,   'Per piece · ₹400–1,000 · Blogs, product descriptions, ad copy'),
  ('Landing Page',                   8000,  'One-time · Single page, responsive, lead form'),
  ('Website — Build Only',           15000, 'One-time · Up to 8 pages, 2 revisions (supplied content)'),
  ('Website — Full',                 25000, 'One-time · Build + copywriting + stock images'),
  ('E-commerce Site',                45000, 'from ₹45,000 · Store up to 50 products, payment + shipping'),
  ('Website Redesign',               0,     'Scoped — quoted per requirement · Rebuild of existing site'),
  ('Website Maintenance',            4000,  'Per month · Updates, backups, security, uptime'),
  ('Speed / SEO Optimization',       6000,  'One-time · ₹6,000–12,000 · Core Web Vitals + on-page tech'),
  ('Mobile App Development',         0,     'Scoped — quoted per requirement · iOS / Android / cross-platform'),
  ('ERP Development',                0,     'Scoped — quoted per requirement · Inventory, HR/payroll, accounting, procurement, reporting'),
  ('CRM Development',                0,     'Scoped — quoted per requirement · Perfex-based or custom'),
  ('Web App / SaaS / Portal',        0,     'Scoped — quoted per requirement · Auth, billing, admin, dashboards, roles'),
  ('Integrations / APIs',            0,     'Scoped — quoted per requirement · Third-party integrations, custom APIs, webhooks'),
  ('Software Maintenance & Support (AMC)', 0, 'Scoped · AMC bug fixes, minor updates, uptime; or feature retainer per dev-day / sprint'),
  ('Watxio (WhatsApp Business)',     0,     'Subscription (confirm) + WhatsApp API cost · Setup, broadcasts, chatbot, catalogue'),
  ('CRM Product (Perfex-based)',     0,     'Setup + license (confirm) · Ready CRM, setup, license, training')
on conflict (name) do nothing;

-- Derive each service's pricing unit from its description prefix (see
-- migration 20260906160000_services_unit.sql for the rationale — DRY parse,
-- deterministic, re-runnable).
update public.services set unit = case
  when description like 'One-time%'        then 'one-time'
  when description like 'Per day%'         then 'day'
  when description like 'Per half-day%'    then 'half-day'
  when description like 'Per project%'     then 'project'
  when description like 'Per session%'     then 'session'
  when description like 'Per page%'        then 'page'
  when description like 'Per set%'         then 'set'
  when description like 'Per email%'       then 'email'
  when description like 'Per 1,000 words%' then 'per-1000-words'
  when description like 'Per minute%'      then 'minute'
  when description like 'Per video%'       then 'video'
  when description like 'Per reel%'        then 'reel'
  when description like 'Per episode%'     then 'episode'
  when description like 'Per image%'       then 'image'
  when description like 'Per product%'     then 'product'
  when description like 'Per property%'    then 'property'
  when description like 'Per SKU%'         then 'sku'
  when description like 'Each%'            then 'each'
  when description like 'Scoped%'          then 'scoped'
  when description like 'from ₹%'          then 'one-time'
  when description like 'Setup + license%' then 'one-time'
  else 'month'
end;

-- ---- Config row (not seed data) ------------------------------------------

insert into public.settings (id) values (1) on conflict do nothing;
