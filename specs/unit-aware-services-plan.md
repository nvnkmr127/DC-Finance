# Plan: Unit-aware services & pricing

## Problem
The `services` catalog now holds items priced in many different units — per month,
one-time, per 1,000 words, per day, per image, per project, "scoped" — after seeding
the DigiCloudify partner rate card (95 items). But the schema stores a single numeric
`price` with no unit, and the UI hardcodes `/mo`:

- `src/components/service-search.tsx:222` renders `{formatCurrency(price)}/mo` for every result.
- `src/components/service-search.tsx:97` toast says `...custom price {x}/mo`.

So "Product / Studio Shoot" (per day) and "Blog — Write Only" (per 1,000 words) both
display as "…/mo", which is wrong and will carry the wrong unit into any quote/invoice.
Today the real unit only survives as prose inside `description`.

## Goal
Give each service an explicit unit, show it correctly everywhere a price is shown, and
carry it into invoice line items so a per-day or per-piece service quotes correctly.

## Non-goals (out of scope)
- Partner-margin / markup quoting (separate plan).
- 18% GST on invoices (separate plan).
- Multi-currency unit formatting beyond the existing `formatCurrency`.
- Reworking the `description` prose already seeded (it stays as the human note).

## What already exists (reuse, don't rebuild)
- `services` table: `id, name unique, price numeric, description, created_at, updated_at`
  (`supabase/schema.sql:418`, migration `20260906140000_services.sql`).
- `Service` / `ServiceInput` types + all CRUD + localStorage fallback in `src/lib/services.ts`.
- `ServiceSearch` dropdown with inline custom-price creation (`src/components/service-search.tsx`).
- `invoice_items` table already has `quantity`, `unit_price`, `amount`
  (migration `20260906130000_invoicing.sql`) — a per-unit service maps to
  `quantity × unit_price`. No schema change needed on the invoice side.
- `useSettings().formatCurrency` for money rendering.

## Design

### Data
Add one column: `services.unit text not null default 'month'`.

Allowed values (short, display-oriented; kept as a plain text set, validated with a
CHECK so a direct API call can't insert garbage):
`month, one-time, day, half-day, project, session, each, page, set, email,
per-1000-words, minute, video, reel, episode, image, product, property, scoped`.

- New migration `2026090616xxxx_services_unit.sql`: `add column ... default 'month'`,
  a `check (unit in (...))` constraint (NOT VALID so it can't fail on existing rows),
  then backfill units for the seeded rate-card rows by name (single UPDATE with a
  CASE or a small mapping table).
- Mirror the column + backfill into `supabase/schema.sql` so fresh setups match.
- `'scoped'` renders as "quoted per requirement" and suppresses the price figure.

### Display
- One helper `formatUnit(unit): string` in `src/lib/format.ts` returning the suffix
  (`'/mo'`, `' one-time'`, `'/day'`, `'/1,000 words'`, `''` for scoped, …). Single
  source of truth so the dropdown, invoice form, and any future quote all agree.
- `ServiceSearch`: replace the hardcoded `/mo` at :222 with `formatUnit(service.unit)`;
  fix the toast at :97. For `unit='scoped'` show "Quoted" instead of a figure.
- `Service` / `ServiceInput` types gain `unit`. The custom-create UI gets a small
  unit `<select>` (defaults to `month`, so existing behavior is unchanged when ignored).

### Invoice wiring
- When a service is selected into an invoice line item, seed `unit_price` from the
  service price and surface the unit next to quantity so the operator sees the basis
  (e.g. "3 × ₹6,000 / day"). `amount = quantity × unit_price` is unchanged.
- `'scoped'` services insert with `unit_price = 0` and a note; the operator fills the
  negotiated figure manually.

## Edge cases / failure modes
- Existing rows before migration: `default 'month'` keeps them behaving exactly as today.
- Unknown/legacy unit value read by an old client: `formatUnit` falls back to `''` (no
  wrong suffix) rather than throwing.
- localStorage fallback services in `src/lib/services.ts` (used when DB is unreachable):
  give the 6 defaults a `unit` too so offline mode matches.
- Direct Supabase insert with a bad unit → rejected by the CHECK constraint.

## Test / verification
- One SQL check: insert a row with an invalid unit → expect constraint violation;
  insert `'day'` → succeeds.
- `formatUnit` unit test: known units map correctly; unknown → `''`; `'scoped'` → `''`.
- Manual: open a client/invoice form, confirm a per-day service shows `/day` in the
  dropdown and the invoice line shows the right basis; confirm a `month` service is
  unchanged from today.

## Rollout
Additive, backward-compatible. Column defaults to `month`; UI degrades to no-suffix on
unknown units. No data migration risk (defaulted column).

---

## /autoplan outcome (implemented)

Dual-voice review (Claude inline + independent cold-start subagent; Codex CLI absent)
reshaped the plan. Decisions:

| # | Decision | Why |
|---|----------|-----|
| 1 | **Dropped the invoice-wiring section** | `ServiceSearch` is used only in `client-form.tsx`; `invoice-form.tsx` line items are hand-typed. No service→invoice path exists, so there was nothing to wire. |
| 2 | **Added the real fix: gate `monthly_value` auto-fill on `unit==='month'`** | Both voices flagged `client-form.tsx:151` pouring any service price into `monthly_value`, inflating MRR for per-day/per-piece/one-time items. This, not the `/mo` label, was the data-corruption bug. |
| 3 | **Backfill by parsing `description` prefix, not a name CASE** | DRY, deterministic, and covers `Per SKU` + the four prefix-less rows the name list would have silently defaulted to `/mo`. |
| 4 | **Updated `createService`/`updateService` payloads + `DEFAULT_SERVICES`** | Both CRUD paths whitelisted 3 fields — `unit` would never have round-tripped otherwise. |
| 5 | **Dropped `NOT VALID`; skipped the CHECK constraint entirely** | Defaulted column can't fail a plain CHECK; and `unit` is display-only (unknown → no suffix, UI `<select>` constrains input), so a drop/recreate-per-unit CHECK is friction with no security value. RLS boundary untouched. |
| 6 | **Fixed all six `/mo` sites + placeholders** | service-search (result, toast, placeholder), settings (list, toast), client-form (hint). |

Judgment calls the user may want to revisit (prefix-less rows): `E-commerce Site` →
one-time, `Explainer Video` → one-time, `Watxio` → month, `CRM Product` → one-time.
Left as-is (client billing cadence, not catalog unit): `clients/[id]` `monthly_value`
"/mo" and the pricing-history "/mo".

Verification: `tsc --noEmit` clean; eslint clean except 2 pre-existing `set-state-in-effect`
errors (settings:71, client-form:89 — not introduced here); dev server compiles and boots.
End-to-end unit display unverified — auth-gated and needs the migration applied to the
remote Supabase.
