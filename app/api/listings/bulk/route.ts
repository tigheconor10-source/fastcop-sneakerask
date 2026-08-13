import { NextRequest, NextResponse } from "next/server";
import { createTrackedListing, findTrackedListingByProductSize, updateTrackedListing } from "../../../../lib/db";
import { createOrUpdateListingsBulk, getSneakeraskProduct } from "../../../../lib/sneakerask";

export const runtime = "nodejs";
export const maxDuration = 60;

type BulkItem = {
  sneakeraskProductId: number;
  sku: string;
  title: string;
  image: string | null;
  brand: string | null;
  size: string;
  costPrice: number;
  minProfit: number;
  askPrice: number;
  quantity?: number;
};

/**
 * POST /api/listings/bulk — la "cesta": crea/actualiza VARIOS anuncios de
 * golpe (hasta 200) en una sola llamada a sneakerask, en vez de una
 * petición por cada talla. Luego guarda/actualiza el seguimiento local
 * de cada uno (sin duplicar filas si ya estaba trackeado).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items: BulkItem[] = body.items;
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Falta la lista de items" }, { status: 400 });
    }
    if (items.length > 200) {
      return NextResponse.json({ error: "Máximo 200 anuncios por lote (límite de la API de sneakerask)" }, { status: 400 });
    }

    // 1) Crea/actualiza todo de golpe en sneakerask
    const result = await createOrUpdateListingsBulk(
      items.map((i) => ({ productId: i.sneakeraskProductId, size: i.size, askPrice: i.askPrice, quantity: i.quantity ?? 1 }))
    );

    // 2) La respuesta en bulk NO trae el listing_id de cada uno — hay que
    // volver a consultar cada producto (una vez por producto único) para
    // sacar el listing_id real de cada talla creada/actualizada.
    const uniqueProductIds = [...new Set(items.map((i) => i.sneakeraskProductId))];
    const listingIdByKey = new Map<string, number | null>();
    for (const productId of uniqueProductIds) {
      const product = await getSneakeraskProduct(productId);
      for (const s of product?.sizes ?? []) {
        listingIdByKey.set(`${productId}__${s.size}`, s.listing_id);
      }
    }

    // 3) Guarda/actualiza el seguimiento local de cada item
    const saved = [];
    for (const item of items) {
      const listingId = listingIdByKey.get(`${item.sneakeraskProductId}__${item.size}`) ?? null;
      const existing = await findTrackedListingByProductSize(item.sneakeraskProductId, item.size);
      if (existing) {
        await updateTrackedListing(existing.id, {
          sneakeraskListingId: listingId ?? undefined,
          askPrice: item.askPrice,
          quantity: item.quantity ?? 1,
        });
        saved.push({ ...item, id: existing.id, updated: true });
      } else {
        const created = await createTrackedListing({
          sneakeraskProductId: item.sneakeraskProductId,
          sneakeraskListingId: listingId,
          sku: item.sku,
          title: item.title,
          image: item.image,
          brand: item.brand,
          size: item.size,
          costPrice: item.costPrice,
          minProfit: item.minProfit,
          askPrice: item.askPrice,
          quantity: item.quantity ?? 1,
        });
        saved.push({ ...item, id: created.id, updated: false });
      }
    }

    return NextResponse.json({ ok: true, sneakeraskResult: result, saved });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
