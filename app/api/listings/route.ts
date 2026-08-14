import { NextRequest, NextResponse } from "next/server";
import { createTrackedListing, listTrackedListings } from "../../../lib/db";
import { createOrUpdateListing, getSneakeraskProduct } from "../../../lib/sneakerask";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const listings = await listTrackedListings();
    return NextResponse.json({ listings });
  } catch (e: any) {
    // Antes esto rompía toda la app en el navegador (respuesta vacía, no
    // JSON) si la tabla tracked_listings aún no existía en la BD nueva.
    // Ahora siempre devuelve JSON válido, aunque sea un error.
    return NextResponse.json({ listings: [], error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sneakeraskProductId, sku, title, image, brand, size, costPrice, minProfit, askPrice, quantity, targetAskType } = body;

    if (!sneakeraskProductId || !size || !askPrice || costPrice === undefined) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    // Crea (o actualiza si ya existía esa talla) el anuncio de verdad en sneakerask
    const result = await createOrUpdateListing({
      productId: sneakeraskProductId,
      size,
      askPrice,
      quantity: quantity ?? 1,
      status: "active",
    });

    // La API no devuelve el listing_id directamente al crear — lo sacamos
    // volviendo a consultar el producto (ahí sí viene relleno).
    const refreshed = await getSneakeraskProduct(sneakeraskProductId);
    const sizeInfo = refreshed?.sizes.find((s) => s.size === size);
    const sneakeraskListingId = sizeInfo?.listing_id ?? null;

    const listing = await createTrackedListing({
      sneakeraskProductId,
      sneakeraskListingId,
      sku,
      title,
      image: image ?? null,
      brand: brand ?? null,
      size,
      costPrice,
      minProfit: minProfit ?? 20,
      askPrice,
      quantity: quantity ?? 1,
      targetAskType: targetAskType === "express" ? "express" : "standard",
    });

    return NextResponse.json({ ok: true, listing, sneakeraskResult: result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
