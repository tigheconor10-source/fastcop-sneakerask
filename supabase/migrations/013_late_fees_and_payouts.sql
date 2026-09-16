-- =========================================================
-- FASE III: plazo de envío laborable (48h, sin findes) +
-- multa por retraso + soporte para SEPA.
-- Pégalo en Supabase SQL Editor y pulsa "Run"
-- =========================================================

-- Multa por envío tardío aplicada a esta comisión (0 si no aplica).
-- Se calcula y "congela" en el momento de marcar como pagada / generar SEPA.
alter table public.commissions add column if not exists late_penalty numeric(10, 2) not null default 0;

-- Plazo de envío: se fija cuando el ADMIN sube la shipping label (no al
-- venderse) - 48h LABORABLES desde ese momento (sin sábados/domingos, ver
-- lib/businessHours.ts), + horas extra que el admin pueda conceder después.
-- Queda en null hasta que haya label.
alter table public.sales add column if not exists shipping_deadline timestamptz;
alter table public.sales add column if not exists shipping_extension_hours integer not null default 0;
