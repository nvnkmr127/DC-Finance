-- Frontend-configurable email reminder settings (the Resend API key stays in
-- server env; these just control whether/how reminders are sent).
alter table public.settings add column if not exists email_reminders_enabled boolean not null default false;
alter table public.settings add column if not exists reminder_from_email text;
