-- =========================================================
-- FASE G: política DELETE para que el consignador pueda borrar sus listings
-- Pégalo en Supabase SQL Editor y pulsa "Run"
-- =========================================================

-- Sin esta política, la ruta DELETE fallaba en silencio (RLS bloqueaba el borrado).
create policy "products: el consignador puede borrar los suyos"
  on public.products for delete
  using (consignor_id = auth.uid());
