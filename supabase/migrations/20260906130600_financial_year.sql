-- Re-introduce the financial-year start (MM-DD) for FY-to-date reporting.
alter table public.settings add column if not exists financial_year_start text not null default '04-01';
