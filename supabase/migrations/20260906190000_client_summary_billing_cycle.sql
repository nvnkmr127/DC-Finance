-- Recreate client_summary so it exposes billing_cycle.
--
-- The view (from 20260906120000) was defined with `c.*`, which Postgres expands
-- to the columns that existed at creation time. Adding clients.billing_cycle in
-- 20260906170000 did NOT add it to the view, so everything that reads the view
-- (client list, dashboard, statements, the edit form) saw billing_cycle as
-- undefined and treated every client as monthly.
--
-- CREATE OR REPLACE VIEW can only append columns, not reorder them — and
-- billing_cycle lands mid-table via `c.*`, which shifts total_received/outstanding
-- and triggers "cannot change name of view column" (42P16). So drop and recreate,
-- then re-grant (dropping a view drops its grants). The `outstanding` figure now
-- amortizes to a monthly equivalent (quarterly ÷ 3, commission excluded).

drop view if exists public.client_summary;

create view public.client_summary
with (security_invoker = true) as
select
  c.*,
  coalesce(sum(p.amount), 0)::numeric as total_received,
  greatest(
    (case c.billing_cycle
       when 'quarterly'  then c.monthly_value / 3.0
       when 'commission' then 0
       else c.monthly_value
     end)
    - coalesce(
        sum(p.amount) filter (
          where date_trunc('month', p.payment_date) = date_trunc('month', current_date)
        ), 0),
    0
  )::numeric as outstanding,
  count(p.id) as payment_count
from public.clients c
left join public.payments p on p.client_id = c.id
group by c.id;

revoke all on public.client_summary from anon;
grant select on public.client_summary to authenticated;
