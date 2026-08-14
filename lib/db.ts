import { sql } from "@vercel/postgres";
import { netCost } from "./vat";

export type TrackedListing = {
  id: string;
  sneakerask_product_id: number;
  sneakerask_listing_id: number | null;
  sku: string;
  title: string;
  image: string | null;
  brand: string | null;
  size: string;
  cost_price: number;
  cost_includes_vat: boolean; // ¿cost_price lleva el 21% de IVA deducible incluido?
  min_profit: number;
  ask_price: number;
  quantity: number;
  status: "active" | "draft";
  target_ask_type: "standard" | "express"; // contra qué precio del mercado compite
  last_is_best: boolean | null;
  last_lowest_standard_ask: number | null;
  last_lowest_express_ask: number | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Precio mínimo de venta calculado sobre el coste REAL (sin IVA si el
 *  coste llevaba IVA deducible incluido) — no sobre el precio bruto que
 *  pagaste, porque ese IVA no es coste de verdad para el negocio. */
export function minSellPrice(costPrice: number, minProfit: number, costIncludesVat: boolean): number {
  return netCost(Number(costPrice), costIncludesVat) + Number(minProfit);
}

/** Beneficio real: precio de venta menos el coste SIN IVA. */
export function profitFor(askPrice: number, costPrice: number, costIncludesVat: boolean): number {
  return Number(askPrice) - netCost(Number(costPrice), costIncludesVat);
}

// Postgres devuelve las columnas `numeric` como texto (para no perder
// precisión), no como número — por eso `cost_price + min_profit` se
// concatenaba como string ("20"+"5"="205") y luego `.toFixed` petaba
// porque un string no tiene ese método. Esto normaliza los números justo
// al leer de la BD, así todo lo que los use después ya recibe numbers de
// verdad, sin tener que acordarse de convertir en cada sitio.
function normalizeListing(row: any): TrackedListing {
  return {
    ...row,
    cost_price: Number(row.cost_price),
    cost_includes_vat: row.cost_includes_vat ?? true,
    min_profit: Number(row.min_profit),
    ask_price: Number(row.ask_price),
    quantity: Number(row.quantity),
    last_lowest_standard_ask: row.last_lowest_standard_ask != null ? Number(row.last_lowest_standard_ask) : null,
    last_lowest_express_ask: row.last_lowest_express_ask != null ? Number(row.last_lowest_express_ask) : null,
  };
}

export async function listTrackedListings(): Promise<TrackedListing[]> {
  const result = await sql`select * from tracked_listings order by created_at desc`;
  return result.rows.map(normalizeListing);
}

export async function getTrackedListing(id: string): Promise<TrackedListing | null> {
  const result = await sql`select * from tracked_listings where id = ${id} limit 1`;
  return result.rows[0] ? normalizeListing(result.rows[0]) : null;
}

export async function createTrackedListing(input: {
  sneakeraskProductId: number;
  sneakeraskListingId: number | null;
  sku: string;
  title: string;
  image: string | null;
  brand: string | null;
  size: string;
  costPrice: number;
  costIncludesVat?: boolean;
  minProfit: number;
  askPrice: number;
  quantity: number;
  targetAskType?: "standard" | "express";
}): Promise<TrackedListing> {
  const result = await sql`
    insert into tracked_listings (
      sneakerask_product_id, sneakerask_listing_id, sku, title, image, brand, size,
      cost_price, cost_includes_vat, min_profit, ask_price, quantity, target_ask_type
    ) values (
      ${input.sneakeraskProductId}, ${input.sneakeraskListingId}, ${input.sku}, ${input.title},
      ${input.image}, ${input.brand}, ${input.size},
      ${input.costPrice}, ${input.costIncludesVat ?? true}, ${input.minProfit}, ${input.askPrice}, ${input.quantity}, ${input.targetAskType ?? "standard"}
    )
    returning *
  `;
  return normalizeListing(result.rows[0]);
}

export async function updateTrackedListing(
  id: string,
  changes: Partial<{
    sneakeraskListingId: number;
    askPrice: number;
    quantity: number;
    status: "active" | "draft";
    lastIsBest: boolean;
    lastLowestStandardAsk: number | null;
    lastLowestExpressAsk: number | null;
    lastCheckedAt: string;
  }>
): Promise<void> {
  const current = await getTrackedListing(id);
  if (!current) throw new Error("Listing no encontrado");

  await sql`
    update tracked_listings set
      sneakerask_listing_id = ${changes.sneakeraskListingId ?? current.sneakerask_listing_id},
      ask_price = ${changes.askPrice ?? current.ask_price},
      quantity = ${changes.quantity ?? current.quantity},
      status = ${changes.status ?? current.status},
      last_is_best = ${changes.lastIsBest ?? current.last_is_best},
      last_lowest_standard_ask = ${changes.lastLowestStandardAsk !== undefined ? changes.lastLowestStandardAsk : current.last_lowest_standard_ask},
      last_lowest_express_ask = ${changes.lastLowestExpressAsk !== undefined ? changes.lastLowestExpressAsk : current.last_lowest_express_ask},
      last_checked_at = ${changes.lastCheckedAt ?? current.last_checked_at},
      updated_at = now()
    where id = ${id}
  `;
}

export async function deleteTrackedListing(id: string): Promise<void> {
  await sql`delete from tracked_listings where id = ${id}`;
}

export async function getDiscordWebhookUrl(): Promise<string | null> {
  const result = await sql`select discord_webhook_url from sneakerask_settings where id = true limit 1`;
  return result.rows[0]?.discord_webhook_url ?? process.env.DISCORD_WEBHOOK_URL ?? null;
}
