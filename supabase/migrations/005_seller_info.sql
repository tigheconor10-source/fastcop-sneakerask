-- =========================================================
-- FASE C: información del vendedor (para contratos de compraventa)
-- Pégalo en Supabase SQL Editor y pulsa "Run"
-- =========================================================

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists id_number text,
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists country text,
  add column if not exists bank_account_holder text,
  add column if not exists bic_swift text;
