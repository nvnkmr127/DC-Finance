-- Services catalog with default pricing
create table if not exists public.services (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  price       numeric not null default 0 check (price >= 0),
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.services enable row level security;

drop policy if exists "services authenticated all" on public.services;
create policy "services authenticated all" on public.services for all to authenticated using (true) with check (true);

grant all on public.services to authenticated;

-- Seed default services
insert into public.services (name, price, description) values
  ('Cloud Hosting & Infrastructure', 15000, 'Managed cloud servers & monitoring'),
  ('Web Application Development', 45000, 'Custom full-stack web development'),
  ('SEO & Performance Optimization', 20000, 'Monthly SEO audits and speed optimization'),
  ('DevOps & CI/CD Pipelines', 35000, 'Automated deployment pipelines and Docker setup'),
  ('IT Support & Maintenance', 25000, 'Ongoing technical support and bug fixes'),
  ('Mobile App Maintenance', 30000, 'iOS and Android updates & maintenance')
on conflict (name) do nothing;
