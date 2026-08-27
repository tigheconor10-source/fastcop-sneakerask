// Precios retail aproximados — sirven para detectar cuando un resultado
// no es una venta directa real (precio muy por encima = reventa,
// muy por debajo = sospechoso/posible falsificación).
// El usuario puede seguir buscando modelos que no estén aquí — en ese
// caso simplemente no se aplica ninguna comprobación de rango.

type RetailEntry = { brand: string; model: string; min: number; max: number };

export const RETAIL_PRICES: RetailEntry[] = [
  { brand: 'nike', model: 'air force 1', min: 100, max: 130 },
  { brand: 'nike', model: 'dunk low', min: 100, max: 130 },
  { brand: 'nike', model: 'air jordan 1', min: 160, max: 195 },
  { brand: 'nike', model: 'air jordan 4', min: 190, max: 225 },
  { brand: 'adidas', model: 'samba', min: 105, max: 150 },
  { brand: 'adidas', model: 'campus', min: 105, max: 130 },
  { brand: 'adidas', model: 'handball spezial', min: 95, max: 120 },
  { brand: 'adidas', model: 'gazelle', min: 105, max: 140 },
  { brand: 'new balance', model: '9060', min: 170, max: 210 },
  { brand: 'new balance', model: '2002r', min: 145, max: 185 },
  { brand: 'new balance', model: '550', min: 125, max: 155 },
  { brand: 'new balance', model: '1906', min: 155, max: 185 },
  { brand: 'asics', model: 'gel-kayano 14', min: 150, max: 185 },
  { brand: 'asics', model: 'gel-nyc', min: 145, max: 175 },
  { brand: 'asics', model: 'gel-1130', min: 105, max: 135 },
  { brand: 'asics', model: 'gt-2160', min: 135, max: 185 },
  { brand: 'salomon', model: 'xt-6', min: 165, max: 195 },
  { brand: 'salomon', model: 'xt-4', min: 175, max: 205 },
  { brand: 'salomon', model: 'acs pro', min: 185, max: 215 },
  { brand: 'on', model: 'cloud 6', min: 145, max: 175 },
  { brand: 'on', model: 'cloudtilt', min: 155, max: 185 },
  { brand: 'on', model: 'cloudmonster', min: 185, max: 215 },
  { brand: 'on', model: 'cloudrunner', min: 145, max: 175 },
  { brand: 'hoka', model: 'clifton', min: 145, max: 175 },
  { brand: 'hoka', model: 'bondi', min: 165, max: 195 },
  { brand: 'hoka', model: 'speedgoat', min: 145, max: 175 },
  { brand: 'hoka', model: 'mafate speed', min: 165, max: 195 },
];

export type PriceCheck = { expected: { min: number; max: number } | null; anomaly: 'none' | 'below' | 'above' };

/**
 * Busca coincidencia de marca+modelo en el texto (query o título del
 * resultado) y compara el precio contra el rango conocido.
 * Si el modelo no está en la tabla, devuelve expected: null — no bloquea
 * nada, simplemente no hay comprobación posible para ese modelo.
 */
export function checkPriceAgainstRetail(text: string, price: number | null): PriceCheck {
  const lower = text.toLowerCase();
  const match = RETAIL_PRICES.find(
    (e) => lower.includes(e.brand) && lower.includes(e.model)
  );

  if (!match || price === null) return { expected: null, anomaly: 'none' };

  // Margen de tolerancia del 15% antes de marcar anomalía —tiendas
  // pequeñas a veces tienen descuento u overhead legítimo
  const tolerance = 0.15;
  const min = match.min * (1 - tolerance);
  const max = match.max * (1 + tolerance);

  if (price < min) return { expected: { min: match.min, max: match.max }, anomaly: 'below' };
  if (price > max) return { expected: { min: match.min, max: match.max }, anomaly: 'above' };
  return { expected: { min: match.min, max: match.max }, anomaly: 'none' };
}
