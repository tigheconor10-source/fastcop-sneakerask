-- Monitores Shopify
create table if not exists shopify_monitors (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  store_domain text not null,
  product_handle text not null,
  label text,
  discord_webhook_url text not null,
  active boolean not null default true,
  last_price text,
  last_variants jsonb,
  last_checked_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

-- Monitores web genéricos
create table if not exists web_monitors (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  label text,
  price_selector text not null default '.current-price',
  stock_selector text,
  last_price text,
  last_stock text,
  last_checked_at timestamptz,
  last_changed_at timestamptz,
  active boolean not null default true,
  discord_webhook_url text not null,
  error text,
  created_at timestamptz not null default now()
);

-- Lock para /api/cron y /api/cron/shopify: evita que dos ejecuciones se
-- solapen si cron-job.org dispara dos veces seguidas o un tick tarda más
-- de lo normal.
create table if not exists cron_state (
  id boolean primary key default true,
  locked_at timestamptz,
  shopify_locked_at timestamptz
);
insert into cron_state (id) values (true) on conflict (id) do nothing;

-- Cola de búsquedas en tiendas asiáticas (.jp, .kr, .hk, .sg, .tw, .th).
-- Esta tabla faltaba en el schema aunque el código (lib/asia-search.ts,
-- /api/search-asia/queue, /api/cron/asia-search) ya la esperaba — por eso
-- nunca había funcionado la búsqueda de Asia.
create table if not exists asia_search_queue (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  status text not null default 'pending', -- pending | processing | done | error
  results jsonb,
  error text,
  searched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_asia_search_queue_status on asia_search_queue(status, created_at);
