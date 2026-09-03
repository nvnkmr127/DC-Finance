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

drop trigger if exists set_updated_at on public.settings;
create trigger set_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

alter table public.settings enable row level security;
drop policy if exists "settings anon all" on public.settings;
create policy "settings anon all" on public.settings for all to anon using (true) with check (true);

grant all on public.settings to anon;

insert into public.settings (id) values (1) on conflict do nothing;
