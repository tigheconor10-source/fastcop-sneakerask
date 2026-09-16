// Tabla de tarifas de consignment de Fastcop (actualizada Jun 2025).
// El precio de venta en Shopify = payout del consignador + tarifa de su tramo.

export const CONSIGNMENT_FEE_TIERS: { max: number; fee: number }[] = [
  { max: 99,       fee: 50  },
  { max: 149,      fee: 55  },
  { max: 199,      fee: 58  },
  { max: 249,      fee: 63  },
  { max: 299,      fee: 68  },
  { max: 349,      fee: 72  },
  { max: 399,      fee: 76  },
  { max: 449,      fee: 82  },
  { max: 499,      fee: 85  },
  { max: 699,      fee: 90  },
  { max: 999,      fee: 120 },
  { max: Infinity, fee: 138 },
];

// Sin mínimo de payout: cualquier importe > 0 es válido. Se mantiene la
// constante (en 0) porque algunas fórmulas de abajo la usan como límite
// inferior genérico, pero ya no bloquea ningún payout.
export const MIN_PAYOUT_PRICE = 0;

export function getConsignmentFee(payoutPrice: number): number | null {
  if (payoutPrice < MIN_PAYOUT_PRICE) return null;
  const tier = CONSIGNMENT_FEE_TIERS.find((t) => payoutPrice <= t.max);
  return tier ? tier.fee : CONSIGNMENT_FEE_TIERS[CONSIGNMENT_FEE_TIERS.length - 1].fee;
}

export function calculateSellingPrice(payoutPrice: number): number | null {
  const fee = getConsignmentFee(payoutPrice);
  if (fee === null) return null;
  return Math.round((payoutPrice + fee) * 100) / 100;
}

export function maxPayoutForSellingPrice(targetSellingPrice: number): number | null {
  let best: number | null = null;
  let prevMax = 0;
  for (const tier of CONSIGNMENT_FEE_TIERS) {
    const tierMin = Math.max(prevMax + 1, MIN_PAYOUT_PRICE);
    const candidate = Math.min(tier.max, targetSellingPrice - tier.fee);
    if (candidate >= tierMin && candidate <= tier.max) {
      if (best === null || candidate > best) best = candidate;
    }
    prevMax = tier.max;
  }
  if (best === null || best < MIN_PAYOUT_PRICE) return null;
  return Math.floor(best * 100) / 100;
}
