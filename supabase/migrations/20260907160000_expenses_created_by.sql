-- Track who entered each expense so expense-only (data-entry) users can be shown
-- just their own inputs. New rows default to the inserting user (auth.uid()).
-- Existing rows stay null (admin's historical data), so they won't appear for a
-- restricted user filtering on their own id.
alter table public.expenses
  add column if not exists created_by uuid default auth.uid() references auth.users(id) on delete set null;

create index if not exists expenses_created_by_idx on public.expenses (created_by);
