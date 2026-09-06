-- Lock the database down to signed-in users.
--
-- Until now every table was readable AND writable by the `anon` role, and the
-- anon/publishable key ships in the browser bundle — so anyone who could load
-- the app could read, edit, or delete all financial records. This migration
-- moves all policies and grants from `anon` to `authenticated`, so a valid
-- Supabase Auth session is required for every query. The client-side login gate
-- is only UX; these policies are the real enforcement boundary.
--
-- Create at least one user first (Supabase dashboard → Authentication → Users),
-- otherwise the app will have no one who can sign in.

do $$
declare t text;
begin
  foreach t in array array[
    'clients','employees','payments','expenses',
    'recurring','salary_payments','opening_balances','settings'
  ]
  loop
    -- Drop the old permissive anon policy and its grants.
    execute format('drop policy if exists %I on public.%I', t || ' anon all', t);
    -- Historical policy names varied slightly; drop those too.
    execute format('drop policy if exists %I on public.%I', 'salary anon all', t);
    execute format('drop policy if exists %I on public.%I', 'balances anon all', t);
    execute format('revoke all on public.%I from anon', t);

    -- Grant + policy for authenticated users only.
    execute format('grant all on public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      t || ' authenticated all', t);
  end loop;
end $$;

-- The summary view follows the same rule.
revoke select on public.client_summary from anon;
grant select on public.client_summary to authenticated;

-- Defense in depth: reject nonsensical money at the database level, not just in
-- the client-side zod schemas (which a direct API call could bypass). NOT VALID
-- skips checking existing rows so the migration can't fail on historical data.
do $$
begin
  begin alter table public.payments        add constraint payments_amount_nonneg   check (amount >= 0) not valid; exception when duplicate_object then null; end;
  begin alter table public.expenses        add constraint expenses_amount_nonneg   check (amount >= 0) not valid; exception when duplicate_object then null; end;
  begin alter table public.recurring       add constraint recurring_amount_nonneg  check (amount >= 0) not valid; exception when duplicate_object then null; end;
  begin alter table public.salary_payments add constraint salary_amount_nonneg     check (amount >= 0 and bonus >= 0 and deduction >= 0) not valid; exception when duplicate_object then null; end;
end $$;
