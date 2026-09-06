-- Project / SaaS-product engagements: fixed-value work billed by project, not on
-- a recurring cycle. Payments link to a project (like they do to invoices) so
-- "received vs value" is real. client_id is nullable — internal SaaS products
-- have no external client.

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  client_id   uuid references public.clients(id) on delete set null,
  value       numeric not null default 0 check (value >= 0),
  status      text not null default 'active' check (status in ('active', 'completed', 'on-hold')),
  start_date  date not null default now(),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Link a payment to the project it settles (nullable: retainer/ad-hoc payments still allowed).
alter table public.payments
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists projects_client_id_idx  on public.projects (client_id);
create index if not exists projects_status_idx      on public.projects (status);
create index if not exists payments_project_id_idx  on public.payments (project_id);

drop trigger if exists set_updated_at on public.projects;
create trigger set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

-- Audit trail (reuses the shared trigger fn), matching the other financial tables.
drop trigger if exists audit on public.projects;
create trigger audit after insert or update or delete on public.projects
  for each row execute function public.audit_trigger();

-- Project with client name + payment-derived received/balance.
create or replace view public.project_summary
with (security_invoker = true) as
select
  p.*,
  c.name    as client_name,
  c.company as client_company,
  coalesce(sum(pay.amount), 0)::numeric as received,
  greatest(p.value - coalesce(sum(pay.amount), 0), 0)::numeric as balance
from public.projects p
left join public.clients c on c.id = p.client_id
left join public.payments pay on pay.project_id = p.id
group by p.id, c.name, c.company;

alter table public.projects enable row level security;
drop policy if exists "projects authenticated all" on public.projects;
create policy "projects authenticated all" on public.projects for all to authenticated using (true) with check (true);

grant all on public.projects to authenticated;
grant select on public.project_summary to authenticated;
