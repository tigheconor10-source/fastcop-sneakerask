import { NextResponse } from "next/server";
import { getAllOwnListings } from "../../../../lib/sneakerask";
import { listTrackedListings } from "../../../../lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * GET /api/sneakerask/own-listings — trae TODOS tus anuncios activos en
 * sneakerask (los hayas creado desde esta app o directamente en su
 * dashboard), y marca cuáles ya están siendo vigilados aquí, para poder
 * importar los que falten.
 */
export async function GET() {
  try {
    const [ownListings, tracked] = await Promise.all([getAllOwnListings(), listTrackedListings()]);
    const trackedListingIds = new Set(tracked.map((t) => t.sneakerask_listing_id).filter(Boolean));

    const items = ownListings.map((l) => ({ ...l, alreadyTracked: trackedListingIds.has(l.id) }));
    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
