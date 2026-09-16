-- =========================================================
-- FASE B: nuevos campos en "products" para el flujo de catálogo
-- Pégalo en Supabase SQL Editor y pulsa "Run"
-- =========================================================

alter table public.products
  add column if not exists catalog_id uuid references public.catalog(id),
  add column if not exists vat_type text check (vat_type in ('vat', 'margin_scheme')),
  add column if not exists note text;

-- brand/model/condition ya no son obligatorios cuando el producto viene
-- del catálogo (se copian automáticamente desde "catalog").
alter table public.products alter column condition drop not null;
