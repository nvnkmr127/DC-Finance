-- Webhooks: Outbound event subscriptions and delivery logs.
-- Subscriptions allow external endpoints to receive real-time notifications on finance events
-- (payments, invoices, expenses, etc.) with HMAC-SHA256 signatures.

create table if not exists public.webhooks (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  url        text not null,
  secret     text not null,
  events     text[] not null default '{"*"}',
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.webhook_deliveries (
  id                uuid primary key default gen_random_uuid(),
  webhook_id        uuid not null references public.webhooks(id) on delete cascade,
  event             text not null,
  url               text not null,
  payload           jsonb not null,
  status_code       integer,
  response_body     text,
  execution_time_ms integer,
  success           boolean not null default false,
  error             text,
  delivered_at      timestamptz not null default now()
);

create index if not exists webhooks_is_active_idx on public.webhooks (is_active);
create index if not exists webhook_deliveries_webhook_id_idx on public.webhook_deliveries (webhook_id);
create index if not exists webhook_deliveries_event_idx on public.webhook_deliveries (event);
create index if not exists webhook_deliveries_delivered_at_idx on public.webhook_deliveries (delivered_at desc);

-- updated_at trigger for webhooks
drop trigger if exists set_updated_at on public.webhooks;
create trigger set_updated_at before update on public.webhooks
  for each row execute function public.set_updated_at();

-- RLS: Authenticated users can manage webhooks and read/write deliveries
alter table public.webhooks enable row level security;
drop policy if exists "webhooks read" on public.webhooks;
drop policy if exists "webhooks write" on public.webhooks;
create policy "webhooks read" on public.webhooks for select to authenticated using (true);
create policy "webhooks write" on public.webhooks for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.webhooks to authenticated;

alter table public.webhook_deliveries enable row level security;
drop policy if exists "webhook_deliveries read" on public.webhook_deliveries;
drop policy if exists "webhook_deliveries write" on public.webhook_deliveries;
create policy "webhook_deliveries read" on public.webhook_deliveries for select to authenticated using (true);
create policy "webhook_deliveries write" on public.webhook_deliveries for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.webhook_deliveries to authenticated;
