import { NextRequest, NextResponse } from "next/server";
import { deleteTrackedListing, getTrackedListing, updateTrackedListing } from "../../../../lib/db";
import { deleteListings, updateListing } from "../../../../lib/sneakerask";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const current = await getTrackedListing(params.id);
    if (!current) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    // Antes esto SOLO tocaba tu base de datos local — el anuncio real en
    // sneakerask se quedaba con el precio/cantidad/estado viejo. Ahora,
    // si hay listing_id real, primero se empuja el cambio al marketplace
    // y solo si eso funciona se guarda localmente.
    const pushesToMarket = body.askPrice !== undefined || body.quantity !== undefined || body.status !== undefined;
    if (current.sneakerask_listing_id && pushesToMarket) {
      await updateListing(current.sneakerask_listing_id, {
        price: body.askPrice,
        quantity: body.quantity,
        status: body.status,
      });
    }

    // costPrice, costIncludesVat, minProfit y targetAskType son solo tuyos
    // (privados) — no se mandan a sneakerask, solo cambian cómo calculamos
    // tu margen y contra qué precio compite el vigilante.
    await updateTrackedListing(params.id, {
      askPrice: body.askPrice,
      quantity: body.quantity,
      status: body.status,
      costPrice: body.costPrice,
      costIncludesVat: body.costIncludesVat,
      minProfit: body.minProfit,
      targetAskType: body.targetAskType,
    });

    const updated = await getTrackedListing(params.id);
    return NextResponse.json({ ok: true, listing: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const listing = await getTrackedListing(params.id);
    if (listing?.sneakerask_listing_id) {
      // Borra también el anuncio real en sneakerask, no solo el seguimiento local
      try {
        await deleteListings([listing.sneakerask_listing_id]);
      } catch {
        // si ya no existía en sneakerask, seguimos igualmente con el borrado local
      }
    }
    await deleteTrackedListing(params.id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
