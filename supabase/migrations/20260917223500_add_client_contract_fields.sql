-- Migration: Add contract fields to clients table for Retainer Burn & Renewal Alerts
alter table public.clients
  add column if not exists contract_start_date date,
  add column if not exists contract_end_date date,
  add column if not exists contract_terms text;
