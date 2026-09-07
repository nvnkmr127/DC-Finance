-- A payment is FOR a period (e.g. July) but may be received in a different month
-- (paid mid-August). Track the billing period separately from payment_date so
-- revenue is attributed to the right month, not just when cash arrived.
alter table public.payments add column if not exists billing_month text;

-- Backfill: assume the period equals the month the payment was received.
update public.payments
   set billing_month = to_char(payment_date, 'YYYY-MM')
 where billing_month is null;

alter table public.payments alter column billing_month set default to_char(now(), 'YYYY-MM');
alter table public.payments alter column billing_month set not null;
