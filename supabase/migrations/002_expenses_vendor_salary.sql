-- Adds the vendor column and adds 'Salary' to the category check constraint.
-- Run once in the Supabase SQL editor if you created the schema before this field existed.
alter table public.expenses add column if not exists vendor text;

alter table public.expenses drop constraint if exists expenses_category_check;
alter table public.expenses add constraint expenses_category_check
  check (category in ('Office', 'Software', 'Advertising', 'Equipment',
                      'Travel', 'Internet', 'Electricity', 'Freelancers', 'Salary', 'Other'));
