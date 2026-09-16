-- =========================================================
-- FASE IV: marcar "Shipped" manualmente + tracking manual
-- (mientras no haya tracking automático vía Sendcloud/UPS).
-- Pégalo en Supabase SQL Editor y pulsa "Run"
-- =========================================================

-- Cuándo se marcó como enviado (null = todavía no). Lo marca el ADMIN con
-- un checkbox en /admin/orders una vez confirma que el seller lo ha dejado
-- en el punto de envío / lo han recogido. Mientras esto sea null y se pase
-- el shipping_deadline, se considera "late".
alter table public.sales add column if not exists shipped_at timestamptz;

-- Número de seguimiento (UPS, etc.) que el admin introduce a mano. Visible
-- también para el seller en /dashboard/orders una vez puesto.
alter table public.sales add column if not exists tracking_number text;
