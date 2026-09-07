import { sql } from "@vercel/postgres";

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
  min_profit: number;
  ask_price: number;
  quantity: number;
  status: "active" | "draft";
  last_is_best: boolean | null;
  last_lowest_standard_ask: number | null;
  last_lowest_express_ask: number | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

export function minSellPrice(costPrice: number, minProfit: number): number {
  return Number(costPrice) + Number(minProfit);
}

export function profitFor(askPrice: number, costPrice: number): number {
  return Number(askPrice) - Number(costPrice);
}

// Postgres devuelve las columnas numeric/decimal como STRING en JS,
// aunque el tipo TrackedListing diga "number" — @vercel/postgres no las
// convierte solo. Sin esto, "cost_price" + "min_profit" en el frontend
// concatena texto en vez de sumar (y luego .toFixed() revienta porque
// un string no tiene ese método) — eso es lo que rompía la página con
// "Application error: a client-side exception has occurred".
function mapRow(row: any): TrackedListing {
  return {
    ...row,
    cost_price: Number(row.cost_price),
    min_profit: Number(row.min_profit),
    ask_price: Number(row.ask_price),
    quantity: Number(row.quantity),
    last_lowest_standard_ask: row.last_lowest_standard_ask != null ? Number(row.last_lowest_standard_ask) : null,
    last_lowest_express_ask: row.last_lowest_express_ask != null ? Number(row.last_lowest_express_ask) : null,
  };
}

export async function listTrackedListings(): Promise<TrackedListing[]> {
  const result = await sql`select * from tracked_listings order by created_at desc`;
  return result.rows.map(mapRow);
}

export async function getTrackedListing(id: string): Promise<TrackedListing | null> {
  const result = await sql`select * from tracked_listings where id = ${id} limit 1`;
  return result.rows[0] ? mapRow(result.rows[0]) : null;
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
  minProfit: number;
  askPrice: number;
  quantity: number;
}): Promise<TrackedListing> {
  const result = await sql`
    insert into tracked_listings (
      sneakerask_product_id, sneakerask_listing_id, sku, title, image, brand, size,
      cost_price, min_profit, ask_price, quantity
    ) values (
      ${input.sneakeraskProductId}, ${input.sneakeraskListingId}, ${input.sku}, ${input.title},
      ${input.image}, ${input.brand}, ${input.size},
      ${input.costPrice}, ${input.minProfit}, ${input.askPrice}, ${input.quantity}
    )
    returning *
  `;
  return mapRow(result.rows[0]);
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
