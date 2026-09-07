-- Emails restricted to the Expenses page only (data-entry role). Admin manages
-- this list in Settings. UI-level gating; see note in the app about RLS.
alter table public.settings
  add column if not exists expense_only_emails text[] not null default '{}';
