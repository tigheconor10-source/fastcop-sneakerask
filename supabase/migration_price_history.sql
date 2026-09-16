-- Historial de cambios de payout por listing.
-- Cada vez que un seller edita su payout, queda registrado aquí.
-- El admin puede verlo en su panel; el seller lo ve en el detalle de su listing.
create table if not exists product_price_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  consignor_id uuid not null,
  old_price numeric not null,
  new_price numeric not null,
  changed_at timestamptz not null default now()
);

create index if not exists idx_price_history_product on product_price_history(product_id, changed_at desc);
