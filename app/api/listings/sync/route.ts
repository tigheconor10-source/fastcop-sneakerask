import { NextResponse } from "next/server";
import { listTrackedListings, updateTrackedListing } from "../../../../lib/db";
import { getAllOwnListings, getSneakeraskProduct } from "../../../../lib/sneakerask";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/listings/sync — relee TODOS tus anuncios reales en sneakerask
 * (active + draft) y los compara con lo que tienes vigilado aquí:
 *   - Si el anuncio sigue existiendo: actualiza precio/estado/mejor-anuncio
 *     con el dato real (por si cambiaste algo a mano y aún no tocaba cron).
 *   - Si le falta la imagen (el endpoint de "tus anuncios" no la trae),
 *     la rellena consultando el catálogo por producto.
 *   - Si el anuncio YA NO EXISTE en sneakerask (lo borraste tú desde su
 *     web): NO se borra solo aquí — se marca como "huérfano" para que lo
 *     veas y decidas tú si lo quitas de la vigilancia.
 */
export async function POST() {
  try {
    const [own, tracked] = await Promise.all([getAllOwnListings(), listTrackedListings()]);
    const ownById = new Map(own.map((o) => [o.id, o]));

    let updated = 0;
    let imagesFilled = 0;
    const orphaned: { id: string; title: string; size: string; sku: string }[] = [];
    const productImageCache = new Map<number, string | null>();

    for (const t of tracked) {
      if (!t.sneakerask_listing_id) continue; // nunca llegó a crearse de verdad, no aplica
      const real = ownById.get(t.sneakerask_listing_id);

      if (!real) {
        orphaned.push({ id: t.id, title: t.title, size: t.size, sku: t.sku });
        continue;
      }

      const priceChanged = real.price !== t.ask_price;
      const statusChanged = real.status !== t.status;

      let image: string | null | undefined = undefined;
      if (!t.image && t.sneakerask_product_id) {
        if (!productImageCache.has(t.sneakerask_product_id)) {
          try {
            const product = await getSneakeraskProduct(t.sneakerask_product_id);
            productImageCache.set(t.sneakerask_product_id, product?.image ?? null);
          } catch {
            productImageCache.set(t.sneakerask_product_id, null);
          }
        }
        image = productImageCache.get(t.sneakerask_product_id) ?? null;
        if (image) imagesFilled++;
      }

      if (priceChanged || statusChanged || image) {
        await updateTrackedListing(t.id, {
          askPrice: real.price,
          status: real.status === "draft" ? "draft" : "active",
          lastIsBest: real.isBestListing,
          ...(image !== undefined ? { image } : {}),
        });
        updated++;
      }
    }

    return NextResponse.json({ ok: true, checked: tracked.length, updated, imagesFilled, orphaned });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
