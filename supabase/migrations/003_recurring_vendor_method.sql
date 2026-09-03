-- Adds vendor and payment_method columns to public.recurring
alter table public.recurring add column if not exists vendor text;
alter table public.recurring add column if not exists payment_method text not null default 'Bank Transfer'
  check (payment_method in ('Bank Transfer', 'UPI', 'Cash', 'Card', 'Other'));

-- Update category check constraint to include 'Salary'
alter table public.recurring drop constraint if exists recurring_category_check;
alter table public.recurring add constraint recurring_category_check
  check (category in ('Office', 'Software', 'Advertising', 'Equipment',
                      'Travel', 'Internet', 'Electricity', 'Freelancers', 'Salary', 'Other'));
