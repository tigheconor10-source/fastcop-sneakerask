-- =========================================================
-- FASE E: consignar variantes existentes (no crear productos nuevos)
-- Pégalo en Supabase SQL Editor y pulsa "Run"
-- =========================================================

-- Precio que tenía la variante de Shopify ANTES de consignarla, para poder
-- restaurarlo si el seller retira el listado (o cuando se vende).
alter table public.products
  add column if not exists original_price numeric(10, 2);

-- Nuevo estado "removed": el seller retiró su listado.
alter table public.products drop constraint if exists products_status_check;
alter table public.products
  add constraint products_status_check
  check (status in ('pending', 'published', 'sold', 'rejected', 'removed'));
