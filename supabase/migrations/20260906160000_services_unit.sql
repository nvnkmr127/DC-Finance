-- Give services an explicit pricing unit so a per-day / per-piece / one-time
-- rate stops rendering (and being treated) as monthly.
--
-- Unit is display-only metadata; the app's `unitSuffix()` falls back to no
-- suffix on any unknown value and the create UI constrains input to the known
-- set, so no CHECK constraint is added (it would only add drop/recreate
-- friction every time a new unit is introduced). No RLS/grant change: `grant
-- all` on the table already covers the new column.

alter table public.services add column if not exists unit text not null default 'month';

-- Backfill from the description prefix rather than a name lookup: the rate-card
-- seed already encodes the unit as the leading token ("Per day · …", "One-time
-- · …", "Per SKU · …", "Scoped …"), so parsing it is DRY and can't drift out of
-- sync with a hand-maintained name list. Deterministic and re-runnable.
update public.services set unit = case
  when description like 'One-time%'        then 'one-time'
  when description like 'Per day%'         then 'day'
  when description like 'Per half-day%'    then 'half-day'
  when description like 'Per project%'     then 'project'
  when description like 'Per session%'     then 'session'
  when description like 'Per page%'        then 'page'
  when description like 'Per set%'         then 'set'
  when description like 'Per email%'       then 'email'
  when description like 'Per 1,000 words%' then 'per-1000-words'
  when description like 'Per minute%'      then 'minute'
  when description like 'Per video%'       then 'video'
  when description like 'Per reel%'        then 'reel'
  when description like 'Per episode%'     then 'episode'
  when description like 'Per image%'       then 'image'
  when description like 'Per product%'     then 'product'
  when description like 'Per property%'    then 'property'
  when description like 'Per SKU%'         then 'sku'
  when description like 'Each%'            then 'each'
  when description like 'Scoped%'          then 'scoped'
  when description like 'from ₹%'          then 'one-time'
  when description like 'Setup + license%' then 'one-time'
  -- 'Per month …', 'Subscription …', legacy rows, and NULL descriptions stay monthly.
  else 'month'
end;
