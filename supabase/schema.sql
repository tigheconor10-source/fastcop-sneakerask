-- =========================================================
-- FASTCOP CONSIGNMENT - Esquema de base de datos
-- =========================================================
-- Cómo usar este archivo:
-- 1. Entra en tu proyecto de Supabase
-- 2. Ve a "SQL Editor" (menú izquierdo)
-- 3. Pega TODO este archivo y pulsa "Run"
-- Esto crea las 4 tablas, los permisos de seguridad (RLS)
-- y un disparador (trigger) que crea el perfil automáticamente
-- la primera vez que alguien hace login con Discord.
-- =========================================================

-- ---------------------------------------------------------
-- 1. PROFILES
-- Un registro por cada persona que inicia sesión (consignador o admin)
-- Se crea automáticamente al hacer login con Discord (ver trigger más abajo)
-- ---------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  discord_id text unique,
  discord_username text,
  discord_avatar text,
  email text,
  iban text,
  vat_number text,
  notify_discord boolean not null default true,
  is_admin boolean not null default false,
  is_approved boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 2. PRODUCTS
-- Cada par de zapatillas que un consignador sube
-- status: 'pending' | 'published' | 'sold' | 'rejected'
-- ---------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  consignor_id uuid not null references public.profiles (id) on delete cascade,
  brand text not null,
  model text not null,
  size text not null,
  condition text not null,
  desired_price numeric(10, 2) not null,
  photos text[] not null default '{}',
  status text not null default 'pending'
    check (status in ('pending', 'published', 'sold', 'rejected')),
  shopify_product_id text,
  shopify_variant_id text,
  admin_notes text,
  commission_rate numeric(5, 2) not null default 20,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_consignor_id_idx on public.products (consignor_id);
create index if not exists products_status_idx on public.products (status);

-- ---------------------------------------------------------
-- 3. SALES
-- Se crea automáticamente cuando llega el webhook "orders/create" de Shopify
-- shipping_status: 'unshipped' | 'shipped' | 'delivered'
-- ---------------------------------------------------------
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  consignor_id uuid not null references public.profiles (id) on delete cascade,
  shopify_order_id text not null,
  sale_price numeric(10, 2) not null,
  customer_name text,
  shipping_address text,
  shipping_city text,
  shipping_zip text,
  shipping_country text,
  shipping_status text not null default 'unshipped'
    check (shipping_status in ('unshipped', 'shipped', 'delivered')),
  created_at timestamptz not null default now()
);

create index if not exists sales_consignor_id_idx on public.sales (consignor_id);
create unique index if not exists sales_shopify_order_product_idx
  on public.sales (shopify_order_id, product_id);

-- ---------------------------------------------------------
-- 4. COMMISSIONS
-- Se crea junto con cada "sale". status: 'pending' | 'paid'
-- ---------------------------------------------------------
create table if not exists public.commissions (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  consignor_id uuid not null references public.profiles (id) on delete cascade,
  sale_price numeric(10, 2) not null,
  commission_rate numeric(5, 2) not null,
  fastcop_fee numeric(10, 2) not null,
  consignor_amount numeric(10, 2) not null,
  status text not null default 'pending'
    check (status in ('pending', 'paid')),
  created_at timestamptz not null default now()
);

create index if not exists commissions_consignor_id_idx on public.commissions (consignor_id);

-- =========================================================
-- TRIGGER: crear perfil automáticamente al hacer login con Discord
-- =========================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, discord_id, discord_username, discord_avatar, email)
  values (
    new.id,
    new.raw_user_meta_data ->> 'provider_id',
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================================
-- ROW LEVEL SECURITY (RLS)
-- =========================================================
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.commissions enable row level security;

-- Función auxiliar: ¿el usuario actual es admin?
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ---- PROFILES ----
create policy "profiles: ver el propio o admin ve todos"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

create policy "profiles: actualizar el propio"
  on public.profiles for update
  using (id = auth.uid());

create policy "profiles: admin actualiza cualquiera"
  on public.profiles for update
  using (public.is_admin());

-- ---- PRODUCTS ----
create policy "products: el consignador ve los suyos, admin ve todos"
  on public.products for select
  using (consignor_id = auth.uid() or public.is_admin());

create policy "products: el consignador crea los suyos"
  on public.products for insert
  with check (consignor_id = auth.uid());

create policy "products: el consignador edita los suyos si están pendientes"
  on public.products for update
  using (consignor_id = auth.uid() and status = 'pending');

create policy "products: admin edita cualquiera"
  on public.products for update
  using (public.is_admin());

-- ---- SALES ----
create policy "sales: el consignador ve las suyas, admin ve todas"
  on public.sales for select
  using (consignor_id = auth.uid() or public.is_admin());

create policy "sales: el consignador actualiza el estado de envío de las suyas"
  on public.sales for update
  using (consignor_id = auth.uid() or public.is_admin());

-- Las filas de "sales" las inserta el backend (webhook de Shopify) usando la
-- service role key, que se salta RLS, así que no hace falta policy de insert.

-- ---- COMMISSIONS ----
create policy "commissions: el consignador ve las suyas, admin ve todas"
  on public.commissions for select
  using (consignor_id = auth.uid() or public.is_admin());

create policy "commissions: solo admin actualiza (marcar como pagado)"
  on public.commissions for update
  using (public.is_admin());

-- =========================================================
-- STORAGE: bucket para las fotos de los productos
-- =========================================================
insert into storage.buckets (id, name, public)
values ('product-photos', 'product-photos', true)
on conflict (id) do nothing;

create policy "product-photos: cualquiera puede ver las fotos"
  on storage.objects for select
  using (bucket_id = 'product-photos');

create policy "product-photos: usuarios logueados pueden subir"
  on storage.objects for insert
  with check (bucket_id = 'product-photos' and auth.role() = 'authenticated');

-- =========================================================
-- ÚLTIMO PASO MANUAL (hazlo después de iniciar sesión 1 vez en el portal):
-- Conviértete en admin ejecutando esto (sustituye TU_DISCORD_ID):
--
--   update public.profiles set is_admin = true where discord_id = 'TU_DISCORD_ID';
--
-- Tu Discord ID lo puedes ver activando el "Modo desarrollador" en Discord
-- (Ajustes > Avanzado) y luego clic derecho sobre tu perfil > "Copiar ID".
-- =========================================================

-- =========================================================
-- MIGRATION: columnas extra en profiles que necesita el código
-- (ejecutar si ya tienes el schema base creado)
-- =========================================================
alter table public.profiles
  add column if not exists full_name text,
  add column if not exists id_number text,
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists zip_code text,
  add column if not exists country text,
  add column if not exists bank_account_holder text,
  add column if not exists bic_swift text,
  add column if not exists vacation_mode boolean not null default false,
  add column if not exists vacation_paused_ids text[] not null default '{}';

-- Columnas extra en products
alter table public.products
  add column if not exists original_price numeric(10,2),
  add column if not exists original_sku text,
  add column if not exists catalog_id uuid,
  add column if not exists vat_type text check (vat_type in ('vat', 'margin_scheme')),
  add column if not exists note text,
  add column if not exists id_number text,
  add column if not exists deleted_at timestamptz;

-- Columnas extra en sales
alter table public.sales
  add column if not exists shipping_label_url text,
  add column if not exists shipping_deadline timestamptz,
  add column if not exists shipping_extension_hours integer not null default 0,
  add column if not exists shipped_at timestamptz,
  add column if not exists tracking_number text;

-- Columnas extra en commissions
alter table public.commissions
  add column if not exists late_penalty numeric(10,2) not null default 0;
