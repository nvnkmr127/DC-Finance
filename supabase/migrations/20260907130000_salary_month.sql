-- Salary is for a period (e.g. June) but may be paid in a different month
-- (paid in August) or the same month (June 30). Track the period separately
-- from payment_date so duplicates are detected per salary period, not per pay date.
alter table public.salary_payments add column if not exists salary_month text;

-- Backfill existing rows: assume the period equals the month it was paid.
update public.salary_payments
   set salary_month = to_char(payment_date, 'YYYY-MM')
 where salary_month is null;

alter table public.salary_payments alter column salary_month set default to_char(now(), 'YYYY-MM');
alter table public.salary_payments alter column salary_month set not null;
