import { NextResponse } from "next/server";
import { listTrackedListings, updateTrackedListing } from "../../../../lib/db";
import { getAllOwnListings } from "../../../../lib/sneakerask";

export const runtime = "nodejs";
export const maxDuration = 45;

/**
 * POST /api/listings/sync — relee TODOS tus anuncios reales en sneakerask
 * (active + draft) y los compara con lo que tienes vigilado aquí:
 *   - Si el anuncio sigue existiendo: actualiza precio/estado/mejor-anuncio
 *     con el dato real (por si cambiaste algo a mano y aún no tocaba cron).
 *   - Si el anuncio YA NO EXISTE en sneakerask (lo borraste tú desde su
 *     web): NO se borra solo aquí — se marca como "huérfano" para que lo
 *     veas y decidas tú si lo quitas de la vigilancia.
 */
export async function POST() {
  try {
    const [own, tracked] = await Promise.all([getAllOwnListings(), listTrackedListings()]);
    const ownById = new Map(own.map((o) => [o.id, o]));

    let updated = 0;
    const orphaned: { id: string; title: string; size: string; sku: string }[] = [];

    for (const t of tracked) {
      if (!t.sneakerask_listing_id) continue; // nunca llegó a crearse de verdad, no aplica
      const real = ownById.get(t.sneakerask_listing_id);

      if (!real) {
        orphaned.push({ id: t.id, title: t.title, size: t.size, sku: t.sku });
        continue;
      }

      const priceChanged = real.price !== t.ask_price;
      const statusChanged = real.status !== t.status;
      if (priceChanged || statusChanged) {
        await updateTrackedListing(t.id, {
          askPrice: real.price,
          status: real.status === "draft" ? "draft" : "active",
          lastIsBest: real.isBestListing,
        });
        updated++;
      }
    }

    return NextResponse.json({ ok: true, checked: tracked.length, updated, orphaned });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
