-- Atomically book a recurring template's expense and advance its next date.
--
-- The app used to do this as two separate client calls (insert expense, then
-- update next_payment_date). If the second failed, the expense was booked but
-- the date wasn't advanced, so the operator would record the same charge again.
-- Doing both in one function makes it all-or-nothing.

create or replace function public.record_recurring_payment(
  p_recurring_id uuid,
  p_expense_date date
) returns date
language plpgsql
security invoker
as $$
declare
  r public.recurring;
  v_months int;
  v_next date;
begin
  select * into r from public.recurring where id = p_recurring_id for update;
  if not found then
    raise exception 'Recurring template % not found', p_recurring_id;
  end if;

  insert into public.expenses (
    category, description, vendor, amount, expense_date,
    payment_method, recurring, notes
  )
  values (
    r.category, r.name, coalesce(r.vendor, ''), r.amount, p_expense_date,
    coalesce(r.payment_method, 'Bank Transfer'), true,
    case
      when coalesce(r.notes, '') <> '' then '[Recurring: ' || r.frequency || '] ' || r.notes
      else '[Recurring: ' || r.frequency || ']'
    end
  );

  -- Advance from the template's due date (not the expense date). Postgres
  -- interval math clamps month-end correctly (e.g. Jan 31 + 1 month = Feb 28/29).
  v_months := case r.frequency
    when 'Monthly' then 1
    when 'Quarterly' then 3
    else 12
  end;
  v_next := (r.next_payment_date + (v_months || ' months')::interval)::date;

  update public.recurring set next_payment_date = v_next where id = r.id;
  return v_next;
end;
$$;

revoke all on function public.record_recurring_payment(uuid, date) from public;
grant execute on function public.record_recurring_payment(uuid, date) to authenticated;
