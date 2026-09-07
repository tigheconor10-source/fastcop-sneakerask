import { NextResponse } from "next/server";
import { listTrackedListings } from "../../../lib/db";
import { checkAndRepriceOne } from "../../../lib/watcher";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * GET /api/cron — Vercel Cron llama a esto periódicamente (configurado
 * en vercel.json). Revisa TODOS los anuncios trackeados, uno a uno, y
 * reajusta/avisa según haga falta. Protegido con CRON_SECRET para que
 * no lo pueda disparar cualquiera.
 */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const listings = await listTrackedListings();
  const results = [];

  for (const listing of listings) {
    try {
      const result = await checkAndRepriceOne(listing);
      results.push(result);
    } catch (e: any) {
      results.push({ listingId: listing.id, error: e.message });
    }
  }

  return NextResponse.json({ checked: results.length, results });
}
