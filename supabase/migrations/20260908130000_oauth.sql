-- OAuth 2.0 Authorization Server tables for ChatGPT Actions and external OAuth2 clients.
-- Supports standard Authorization Code Grant (code exchange and refresh token).

create table if not exists public.oauth_clients (
  id            uuid primary key default gen_random_uuid(),
  client_id     text not null unique,
  client_secret text not null,
  name          text not null,
  redirect_uris text[] not null default '{}',
  created_at    timestamptz not null default now()
);

create table if not exists public.oauth_codes (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  client_id    text not null,
  redirect_uri text not null,
  user_id      text,
  scope        text not null default 'finance:read webhooks:write',
  expires_at   timestamptz not null,
  used         boolean not null default false,
  created_at   timestamptz not null default now()
);

create table if not exists public.oauth_tokens (
  id            uuid primary key default gen_random_uuid(),
  access_token  text not null unique,
  refresh_token text not null unique,
  client_id     text not null,
  user_id       text,
  scope         text not null default 'finance:read webhooks:write',
  expires_at    timestamptz not null,
  revoked       boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists oauth_clients_client_id_idx on public.oauth_clients (client_id);
create index if not exists oauth_codes_code_idx on public.oauth_codes (code);
create index if not exists oauth_tokens_access_token_idx on public.oauth_tokens (access_token);
create index if not exists oauth_tokens_refresh_token_idx on public.oauth_tokens (refresh_token);

-- RLS: Authenticated users & service role can manage OAuth tables
alter table public.oauth_clients enable row level security;
alter table public.oauth_codes enable row level security;
alter table public.oauth_tokens enable row level security;

create policy "oauth_clients select" on public.oauth_clients for select to authenticated using (true);
create policy "oauth_clients all" on public.oauth_clients for all to authenticated using (true) with check (true);

create policy "oauth_codes all" on public.oauth_codes for all to authenticated using (true) with check (true);
create policy "oauth_tokens all" on public.oauth_tokens for all to authenticated using (true) with check (true);

grant all on public.oauth_clients to authenticated;
grant all on public.oauth_codes to authenticated;
grant all on public.oauth_tokens to authenticated;
