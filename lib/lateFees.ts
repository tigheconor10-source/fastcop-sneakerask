// Multa fija por no enviar el par dentro del plazo (48h laborables +
// cualquier extensión que el admin haya concedido).
export const LATE_SHIPPING_PENALTY = 15;

type SaleDeadlineFields = {
  shipping_deadline: string | null;
  shipping_extension_hours: number;
  shipped_at: string | null;
};

// El plazo efectivo = shipping_deadline (48h laborables desde la venta) +
// las horas extra que el admin haya concedido (se suman directas, sin
// lógica laborable - es un margen de gracia puntual).
export function effectiveShippingDeadline(sale: SaleDeadlineFields): Date | null {
  if (!sale.shipping_deadline) return null;
  const base = new Date(sale.shipping_deadline).getTime();
  return new Date(base + sale.shipping_extension_hours * 60 * 60 * 1000);
}

// El plazo de 48h SOLO empieza cuando se sube la label (shipping_deadline se
// fija en ese momento, ver /api/admin/sales/[id]/label) - antes de eso
// shipping_deadline es null y nunca se considera "late". Una vez fijado,
// "late" = no se ha marcado como enviado (shipped_at) Y ha pasado el plazo
// efectivo (deadline + extensión concedida).
export function isShipmentLate(sale: SaleDeadlineFields, now: Date = new Date()): boolean {
  if (sale.shipped_at) return false;
  const deadline = effectiveShippingDeadline(sale);
  if (!deadline) return false;
  return now.getTime() > deadline.getTime();
}
