-- =========================================================
-- FASE D: permitir editar el payout después de publicado
-- Pégalo en Supabase SQL Editor y pulsa "Run"
-- =========================================================

drop policy if exists "products: el consignador edita los suyos si están pendientes" on public.products;

create policy "products: el consignador edita los suyos (pendientes o publicados)"
  on public.products for update
  using (consignor_id = auth.uid() and status in ('pending', 'published'));
