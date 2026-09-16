-- =========================================================
-- FASE II: bucket de storage para subir las etiquetas de envío
-- (PDFs/imágenes) desde el admin.
-- Pégalo en Supabase SQL Editor y pulsa "Run"
-- =========================================================

insert into storage.buckets (id, name, public)
values ('shipping-labels', 'shipping-labels', true)
on conflict (id) do nothing;

-- Cualquiera con el link puede ver/descargar la label (el bucket es público,
-- pero las URLs no son adivinables - son las que generamos al subir).
drop policy if exists "shipping-labels: lectura pública" on storage.objects;
create policy "shipping-labels: lectura pública"
  on storage.objects for select
  using (bucket_id = 'shipping-labels');

-- Solo admins pueden subir/reemplazar/borrar labels (las subidas reales
-- las hace el servidor con la service_role key, que se salta RLS - estas
-- políticas son una salvaguarda adicional si se accediera directo).
drop policy if exists "shipping-labels: solo admin sube" on storage.objects;
create policy "shipping-labels: solo admin sube"
  on storage.objects for insert
  with check (bucket_id = 'shipping-labels' and public.is_admin());

drop policy if exists "shipping-labels: solo admin actualiza" on storage.objects;
create policy "shipping-labels: solo admin actualiza"
  on storage.objects for update
  using (bucket_id = 'shipping-labels' and public.is_admin());

drop policy if exists "shipping-labels: solo admin borra" on storage.objects;
create policy "shipping-labels: solo admin borra"
  on storage.objects for delete
  using (bucket_id = 'shipping-labels' and public.is_admin());
