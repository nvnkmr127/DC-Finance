-- Invoicing: invoices + line items, with client payments linkable to an invoice
-- so "outstanding" becomes real (invoiced − paid) instead of assumed. No tax.

create table if not exists public.invoices (
  id             uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  client_id      uuid not null references public.clients(id) on delete restrict,
  issue_date     date not null default now(),
  due_date       date not null default now(),
  status         text not null default 'draft'
                 check (status in ('draft', 'sent', 'cancelled')),
  notes          text,
  total          numeric not null default 0 check (total >= 0),
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

-- Link a payment to the invoice it settles (nullable: ad-hoc payments still allowed).
alter table public.payments
  add column if not exists invoice_id uuid references public.invoices(id) on delete set null;

create index if not exists invoices_client_id_idx      on public.invoices (client_id);
create index if not exists invoices_status_idx         on public.invoices (status);
create index if not exists invoices_issue_date_idx     on public.invoices (issue_date);
create index if not exists invoice_items_invoice_id_idx on public.invoice_items (invoice_id);
create index if not exists payments_invoice_id_idx     on public.payments (invoice_id);

-- updated_at auto-touch (reuses public.set_updated_at from the base schema).
drop trigger if exists set_updated_at on public.invoices;
create trigger set_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();

-- Invoice with client name + payment-derived paid/balance and an effective status
-- (paid/partial are derived from linked payments; draft/sent/cancelled are stored).
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

-- Access: signed-in users only (matches the rest of the schema).
alter table public.invoices      enable row level security;
alter table public.invoice_items enable row level security;

drop policy if exists "invoices authenticated all"      on public.invoices;
drop policy if exists "invoice_items authenticated all" on public.invoice_items;
create policy "invoices authenticated all"      on public.invoices      for all to authenticated using (true) with check (true);
create policy "invoice_items authenticated all" on public.invoice_items for all to authenticated using (true) with check (true);

grant all on public.invoices      to authenticated;
grant all on public.invoice_items to authenticated;
grant select on public.invoice_summary to authenticated;
