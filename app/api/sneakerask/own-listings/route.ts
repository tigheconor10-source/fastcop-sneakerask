import { NextResponse } from "next/server";
import { getAllOwnListings, getSneakeraskProduct } from "../../../../lib/sneakerask";
import { listTrackedListings } from "../../../../lib/db";

export const runtime = "nodejs";
export const maxDuration = 45;

/**
 * GET /api/sneakerask/own-listings — trae TODOS tus anuncios activos en
 * sneakerask (los hayas creado desde esta app o directamente en su
 * dashboard), y marca cuáles ya están siendo vigilados aquí, para poder
 * importar los que falten.
 *
 * El endpoint de "tus anuncios" de sneakerask NO trae la imagen del
 * producto (solo lo trae el buscador de catálogo) — por eso antes salían
 * en blanco. Aquí se rellena la imagen consultando el catálogo por cada
 * product_id único que aparece (una sola vez por producto, no por talla).
 */
export async function GET() {
  try {
    const [ownListings, tracked] = await Promise.all([getAllOwnListings(), listTrackedListings()]);
    const trackedListingIds = new Set(tracked.map((t) => t.sneakerask_listing_id).filter(Boolean));

    const missingImageProductIds = [...new Set(ownListings.filter((l) => !l.image && l.productId).map((l) => l.productId!))];
    const imageByProductId = new Map<number, string | null>();
    await Promise.all(
      missingImageProductIds.map(async (pid) => {
        try {
          const product = await getSneakeraskProduct(pid);
          imageByProductId.set(pid, product?.image ?? null);
        } catch {
          imageByProductId.set(pid, null);
        }
      })
    );

    const items = ownListings.map((l) => ({
      ...l,
      image: l.image ?? (l.productId ? imageByProductId.get(l.productId) ?? null : null),
      alreadyTracked: trackedListingIds.has(l.id),
    }));
    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
