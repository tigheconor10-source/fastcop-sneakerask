/**
 * lib/vat.ts
 * ─────────────────────────────────────────────────────────────
 * Conor factura con IVA general deducible (no está en REBU aquí) — paga,
 * por ejemplo, 90€ con IVA por un par, pero ese IVA (21%) se lo deduce en
 * su declaración, así que su coste REAL a efectos de margen no son los 90€
 * sino el precio sin IVA (~74,38€). Si calculáramos el margen sobre el
 * precio con IVA, estaríamos infravalorando su beneficio real y el
 * "precio mínimo" sería más alto de lo necesario.
 * ─────────────────────────────────────────────────────────────
 */

export const VAT_RATE = 0.21; // IVA general español

/** Precio de coste SIN IVA — el que de verdad cuenta para el margen. */
export function netCost(costPrice: number, costIncludesVat: boolean): number {
  return costIncludesVat ? costPrice / (1 + VAT_RATE) : costPrice;
}

/** Cuánto de ese coste es IVA deducible (solo informativo). */
export function vatPortion(costPrice: number, costIncludesVat: boolean): number {
  return costIncludesVat ? costPrice - netCost(costPrice, costIncludesVat) : 0;
}
