# Digicloudify Finance

A small **internal finance dashboard** for a services business — track money in and out
(clients and their payments, business expenses, recurring bills, employee salaries) and
turn all of it into monthly financial statements. Built for one company's own back-office
use, tuned for Indian businesses (₹ / INR, lakh–crore grouping, `en-IN` dates).

## Tech stack

- **Next.js 16** (App Router) + **React 19** — pages are client-rendered
- **Supabase** (Postgres) — accessed directly from the browser via `@supabase/supabase-js`
- **Auth** — Supabase email/password; database Row-Level Security (`authenticated` only) is the real enforcement boundary
- **UI** — Tailwind CSS v4, shadcn/Radix components, `lucide-react`, `next-themes` (light/dark)
- **Forms** — react-hook-form + Zod · **Charts** — Recharts · **Toasts** — Sonner

## Project layout

```
src/
  app/           One page per feature (dashboard, clients, payments, expenses,
                 recurring, salaries, statements, settings) + a client detail route.
                 error.tsx / global-error.tsx provide error boundaries.
  lib/           Data-access layer — one file per domain, each exporting a Zod
                 schema + typed CRUD functions. supabase/client.ts is a lazy singleton.
  components/    Shared UI: forms, tables, cards, charts, sidebar/topbar, and the
                 settings / auth / theme providers.
supabase/        SQL schema, migrations, RLS policies, and an atomic RPC.
```

## Data model

`clients`, `employees`, `payments` (→ client, optionally → invoice),
`invoices` + `invoice_items` (→ client), `salary_payments` (→ employee), `expenses`,
`recurring` (templates), `opening_balances` (per month), and a singleton `settings` row.
`client_summary` and `invoice_summary` **views** add payment-derived totals. Receipts for
expenses and salary payments live in a private `receipts` Storage bucket (signed-URL
access). `updated_at` triggers keep timestamps fresh; foreign keys protect history (a
client with payments can't be deleted).

## Features

- **Dashboard** — month-at-a-glance: revenue / expenses / salaries / net profit /
  outstanding / recurring stat cards, a 12-month revenue-vs-expenses line chart, monthly
  profit bars, an expense-by-category donut, revenue by client, and lists of outstanding
  clients, pending salaries, recent transactions, and bills due in the next 30 days.
- **Clients** — searchable, sortable, paginated list (monthly value, received,
  outstanding). Add/edit via dialog; delete is blocked while payments exist. Each client
  has a detail page with contact info and a 6-month revenue chart.
- **Invoices** — create invoices with line items and auto-numbering (`INV-0001`);
  statuses (draft / sent / paid / partial / cancelled, the last two derived from linked
  payments); outstanding and overdue totals.
- **Payments** — record and manage client payments (amount, date, method, reference,
  notes), optionally linked to an invoice so its balance and status update automatically.
- **Collections** — aging buckets (not-due / 1–30 / 31–60 / 60+ days), per-invoice days
  overdue, copy-to-clipboard reminder messages, and reminder logging. (Automated email
  reminders can be enabled once an email provider such as Resend is connected.)
- **Expenses** — business expenses by category, with vendor, method, date, and an
  optional receipt attachment.
- **Recurring** — templates for repeating bills (monthly / quarterly / yearly) with
  next-due and overdue tracking. "Record payment" **atomically** books an expense *and*
  advances the next-due date in one transaction, so a charge can't be double-recorded.
- **Salaries** — employees and their salary payments (net = base + bonus − deduction);
  tracks paid vs pending per employee, with optional receipt attachments.
- **Budgets** — set monthly per-category budgets and see budget vs actual with variance.
- **Statements** — six report tabs: Income (P&L), Expense (by category), Cash Flow,
  Client Outstanding, Salary, and a filterable Transactions ledger with a running balance.
  Every tab supports **print** and **CSV export**.
- **Audit Log** — append-only record of every create/update/delete (who, what, when),
  written by a database trigger so it can't be edited from the app.
- **Settings** — company name, default currency, editable expense-category /
  payment-method lists, email-reminder toggle, and a one-click **JSON data export**.

## Getting started

### 1. Set up Supabase

Create a Supabase project, then in the SQL editor run [`supabase/schema.sql`](supabase/schema.sql)
(or apply the files in `supabase/migrations/`). This creates all tables, the
`client_summary` view, the `record_recurring_payment` RPC, and RLS policies restricting
access to signed-in users.

Then create at least one user: **Authentication → Users → Add user** (email + password).
That's the account you'll sign in with.

> **Security note:** RLS grants every signed-in user full read/write to all data. Keep
> public sign-ups **disabled** (Authentication → Providers → Email) unless you intend for
> anyone who registers to see all financial data.

### 2. Configure environment

Copy `.env.local.example` to `.env.local` and fill in your project's values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-or-publishable-key>
```

### 3. Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |

## Notes & limitations

- **Indian-first:** chart axes use lakh/crore compact formatting; the currency setting
  affects symbol/grouping in some places but not compact chart formatting.
- **Scale:** pages load full tables and filter in memory — ideal for a single small
  business; large datasets would need server-side pagination.
