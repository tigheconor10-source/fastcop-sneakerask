import { NextResponse } from "next/server";
import { listTrackedListings } from "../../../lib/db";
import { checkAndRepriceOne } from "../../../lib/watcher";

// Configuración para Vercel Hobby (free)
export const runtime = "nodejs";
export const maxDuration = 10; // Máximo 10 segundos en plan gratuito

/**
 * GET /api/cron — Vercel Cron llama a esto periódicamente
 * Protegido con CRON_SECRET
 * 
 * IMPORTANTE: En plan free, procesa solo 1-2 listings por ejecución
 * para no exceder los 10 segundos
 */
export async function GET(req: Request) {
  // Verificar autorización
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Obtener todos los listings
  const listings = await listTrackedListings();
  
  // En plan free: procesar solo 2 listings por ejecución
  // Para procesar más, necesitarías hacer múltiples llamadas o usar colas
  const listingsToProcess = listings.slice(0, 2);
  
  const results = [];

  for (const listing of listingsToProcess) {
    try {
      const result = await checkAndRepriceOne(listing);
      results.push(result);
    } catch (e: any) {
      results.push({ listingId: listing.id, error: e.message });
    }
  }

  return NextResponse.json({ 
    checked: results.length, 
    total: listings.length,
    results,
    note: "Free plan: processing 2 listings per run. Upgrade for unlimited."
  });
}