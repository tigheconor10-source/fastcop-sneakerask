import { NextRequest, NextResponse } from "next/server";
import { deleteTrackedListing, getTrackedListing, updateTrackedListing } from "../../../../lib/db";
import { deleteListings, updateListing } from "../../../../lib/sneakerask";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const current = await getTrackedListing(params.id);
    if (!current) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    // Si se cambia el precio o la cantidad, hay que empujarlo también al
    // anuncio REAL en sneakerask — antes esto solo tocaba la base de
    // datos local, así que editabas el precio aquí pero en sneakerask
    // seguía saliendo el de siempre.
    if ((body.askPrice !== undefined || body.quantity !== undefined) && current.sneakerask_listing_id) {
      await updateListing(current.sneakerask_listing_id, {
        price: body.askPrice !== undefined ? body.askPrice : undefined,
        quantity: body.quantity !== undefined ? body.quantity : undefined,
      });
    }

    // Solo se pueden tocar tus campos privados y el precio/cantidad —
    // el producto/talla/sku no cambian una vez creado el anuncio.
    await updateTrackedListing(params.id, {
      askPrice: body.askPrice,
      quantity: body.quantity,
      status: body.status,
    });
    if (body.costPrice !== undefined || body.minProfit !== undefined) {
      const { sql } = await import("@vercel/postgres");
      await sql`
        update tracked_listings set
          cost_price = coalesce(${body.costPrice}, cost_price),
          min_profit = coalesce(${body.minProfit}, min_profit),
          updated_at = now()
        where id = ${params.id}
      `;
    }
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
