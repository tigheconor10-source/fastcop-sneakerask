-- =========================================================
-- FASE H: añadir zip_code y city a profiles
-- Pégalo en Supabase SQL Editor y pulsa "Run"
-- =========================================================

alter table public.profiles
  add column if not exists city text,
  add column if not exists zip_code text;
