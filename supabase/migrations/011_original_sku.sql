-- =========================================================
-- FASE I: SKU removal/restoration (para que el bot de precios
-- haga skip de variantes consignadas)
-- Pégalo en Supabase SQL Editor y pulsa "Run"
-- =========================================================

alter table public.products
  add column if not exists original_sku text;
