-- Adds the reference_number column to an already-created payments table.
-- Run once in the Supabase SQL editor if you created the schema before this field existed.
alter table public.payments add column if not exists reference_number text;
