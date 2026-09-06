-- Receipt/document attachments for expenses and salary payments.
-- Files live in a private Storage bucket; the row stores the object path.

alter table public.expenses        add column if not exists receipt_path text;
alter table public.salary_payments add column if not exists receipt_path text;

-- Private bucket (files are reached via short-lived signed URLs, never public).
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- Only signed-in users can read/write objects in this bucket.
drop policy if exists "receipts read"   on storage.objects;
drop policy if exists "receipts insert" on storage.objects;
drop policy if exists "receipts update" on storage.objects;
drop policy if exists "receipts delete" on storage.objects;
create policy "receipts read"   on storage.objects for select to authenticated using (bucket_id = 'receipts');
create policy "receipts insert" on storage.objects for insert to authenticated with check (bucket_id = 'receipts');
create policy "receipts update" on storage.objects for update to authenticated using (bucket_id = 'receipts');
create policy "receipts delete" on storage.objects for delete to authenticated using (bucket_id = 'receipts');
