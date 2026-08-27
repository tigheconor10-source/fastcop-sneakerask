import { NextResponse } from "next/server";
import { listStalestTrackedListings, acquireCronLock, releaseCronLock } from "../../../lib/db";
import { checkAndRepriceOne } from "../../../lib/watcher";

export const runtime = "nodejs";
export const maxDuration = 60;

// Antes esto revisaba TODOS los anuncios trackeados de golpe en cada
// ejecución. Eso tardaba minutos (bien en Vercel, con maxDuration 120) pero
// hacía que cron-job.org SIEMPRE fallara: su timeout máximo es 30s, y
// además la respuesta (un array con el resultado de cada anuncio) superaba
// su límite de tamaño de salida.
//
// Ahora cada tick revisa solo un LOTE PEQUEÑO — los anuncios que llevan más
// tiempo sin comprobarse — y devuelve un resumen corto. Con cron-job.org
// llamando cada minuto, todos los anuncios acaban rotando igual, pero sin
// que ningún tick individual tarde ni pese de más. Así puedes tenerlo a
// cada minuto sin disparar el uso de CPU: cada ejecución hace poco trabajo.
const BATCH_SIZE = 8;

/**
 * GET /api/cron — llamado por cron-job.org cada minuto. Revisa un lote de
 * anuncios trackeados y reajusta/avisa según haga falta. Protegido con
 * CRON_SECRET para que no lo pueda disparar cualquiera.
 */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locked = await acquireCronLock();
  if (!locked) {
    // Ya hay una ejecución en marcha (p.ej. el tick anterior todavía no ha
    // terminado) — no hacemos nada este minuto, evita procesar el mismo
    // anuncio dos veces a la vez.
    return NextResponse.json({ skipped: true, reason: "locked" });
  }

  try {
    const listings = await listStalestTrackedListings(BATCH_SIZE);

    let repriced = 0, alerts = 0, errors = 0;
    for (const listing of listings) {
      try {
        const r = await checkAndRepriceOne(listing);
        if (r.action === "repreciado_automatico") repriced++;
        if (r.action === "alerta_sin_repreciar") alerts++;
      } catch {
        errors++;
      }
    }

    // Resumen corto a propósito — el array completo de resultados era lo
    // que hacía que cron-job.org rechazara la respuesta por tamaño.
    return NextResponse.json({ checked: listings.length, repriced, alerts, errors });
  } finally {
    await releaseCronLock();
  }
}
