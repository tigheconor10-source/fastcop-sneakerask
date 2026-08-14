-- Anuncios de sneakerask que Conor está vigilando. El precio de coste y
-- el beneficio mínimo son PRIVADOS — nunca se mandan a la API de
-- sneakerask, solo se usan aquí para calcular el precio mínimo de venta.
create table if not exists tracked_listings (
  id uuid primary key default gen_random_uuid(),

  sneakerask_product_id integer not null,
  sneakerask_listing_id integer,          -- se rellena en cuanto se crea/encuentra el anuncio
  sku text not null,
  title text not null,
  image text,
  brand text,
  size text not null,

  cost_price numeric not null,            -- lo que pagaste tú (privado)
  min_profit numeric not null default 20, -- beneficio mínimo que quieres siempre

  ask_price numeric not null,             -- precio de venta actual en sneakerask
  quantity integer not null default 1,
  status text not null default 'active' check (status in ('active', 'draft')),
  target_ask_type text not null default 'standard' check (target_ask_type in ('standard', 'express')), -- contra qué precio compites

  last_is_best boolean,                   -- último estado conocido de "mejor anuncio"
  last_lowest_standard_ask numeric,
  last_lowest_express_ask numeric,
  last_checked_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tracked_listings_product on tracked_listings(sneakerask_product_id, size);

-- Configuración general: webhook de Discord para los avisos.
create table if not exists sneakerask_settings (
  id boolean primary key default true,
  discord_webhook_url text
);

insert into sneakerask_settings (id) values (true) on conflict (id) do nothing;

-- Migración para bases de datos ya existentes (si tu tabla ya estaba creada
-- antes de este cambio, esto añade la columna que falta sin borrar nada).
alter table tracked_listings add column if not exists target_ask_type text not null default 'standard';

-- El coste que pagaste puede llevar IVA deducible incluido (cuenta general,
-- no REBU) — este flag dice si cost_price es "con IVA" (por defecto sí,
-- que es tu caso) o ya viene sin IVA. El margen real se calcula siempre
-- sobre el coste SIN IVA, porque ese IVA te lo deducen.
alter table tracked_listings add column if not exists cost_includes_vat boolean not null default true;

-- Firma del último aviso mandado a Discord para este anuncio, para no
-- repetir la misma notificación cada 30 min si la situación no ha
-- cambiado (mismo precio, mismo mínimo del mercado, mismo resultado).
alter table tracked_listings add column if not exists last_alert_signature text;
