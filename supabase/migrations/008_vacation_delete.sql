-- =========================================================
-- FASE F: vacation mode + borrado real de listings
-- Pégalo en Supabase SQL Editor y pulsa "Run"
-- =========================================================

-- Campo para borrar físicamente un listing de la BD cuando el seller lo elimina
alter table public.products
  add column if not exists deleted_at timestamptz;

-- Vacation mode por perfil: guarda qué productos se pausaron para poder
-- reactivarlos. También si está activo el modo.
alter table public.profiles
  add column if not exists vacation_mode boolean not null default false,
  add column if not exists vacation_paused_ids text[] not null default '{}';

-- Label de envío (URL o texto) guardada por el admin para cada venta
alter table public.sales
  add column if not exists shipping_label_url text;
