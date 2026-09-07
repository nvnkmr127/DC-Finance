-- Categories are now user-editable in Settings (settings.expense_categories),
-- so the hardcoded category CHECK constraints reject any custom category.
-- Drop them; the app validates category against the settings list instead.
alter table public.expenses  drop constraint if exists expenses_category_check;
alter table public.recurring drop constraint if exists recurring_category_check;
