-- Human-readable "who entered it" for expenses. Captured from the JWT at insert
-- time so the list can show it without querying auth.users. created_by (uuid)
-- stays the identity/ownership key; this is for display.
alter table public.expenses
  add column if not exists created_by_email text default (auth.jwt() ->> 'email');
