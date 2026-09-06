-- Append-only audit trail: who changed what, when. A SECURITY DEFINER trigger
-- writes the log, and users get SELECT only — so entries can't be forged or
-- deleted from the app.

create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  table_name text not null,
  row_id     text,
  action     text not null,
  actor      text,
  old_data   jsonb,
  new_data   jsonb,
  changed_at timestamptz not null default now()
);

create index if not exists audit_log_changed_at_idx on public.audit_log (changed_at desc);
create index if not exists audit_log_table_idx       on public.audit_log (table_name);

create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_new jsonb;
begin
  if tg_op <> 'INSERT' then v_old := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_new := to_jsonb(new); end if;
  insert into public.audit_log (table_name, row_id, action, actor, old_data, new_data)
  values (
    tg_table_name,
    coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'month', v_old ->> 'month'),
    tg_op,
    coalesce(auth.jwt() ->> 'email', auth.uid()::text),
    v_old,
    v_new
  );
  return coalesce(new, old);
end;
$$;

-- Attach to the financial tables (invoice_items excluded — it's rewritten
-- wholesale on every invoice edit and would just be noise).
do $$
declare t text;
begin
  foreach t in array array[
    'clients','employees','payments','expenses','recurring',
    'salary_payments','invoices','opening_balances','settings'
  ]
  loop
    execute format('drop trigger if exists audit on public.%I', t);
    execute format(
      'create trigger audit after insert or update or delete on public.%I
         for each row execute function public.audit_trigger()', t);
  end loop;
end $$;

alter table public.audit_log enable row level security;
drop policy if exists "audit_log read" on public.audit_log;
create policy "audit_log read" on public.audit_log for select to authenticated using (true);
grant select on public.audit_log to authenticated;
