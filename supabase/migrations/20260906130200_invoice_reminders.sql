-- Track when a payment reminder was last sent for an invoice (collections).
alter table public.invoices add column if not exists last_reminded_at timestamptz;
