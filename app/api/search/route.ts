import { NextResponse } from 'next/server';
import { googleSearch } from '@/lib/google';
import { scrapeProduct } from '@/lib/scraper';
import { shouldSkipDomain } from '@/lib/blocked-domains';
import { checkPriceAgainstRetail } from '@/lib/retail-prices';

export const maxDuration = 45;

// Países "lowkey" con tiendas de zapatillas boutique que casi nunca
// salen en una búsqueda genérica orientada a España — Google indexa
// bien sus dominios, solo hay que pedírselo explícitamente con site:.
const LOWKEY_TLDS = [
  'dk', 'se', 'no', 'fi', 'pl', 'cz', 'at', 'be', 'pt', 'gr', 'ch', 'ie',
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const query = (body.query ?? '').trim();

    if (!query || query.length < 2) {
      return NextResponse.json({ error: 'Escribe al menos 2 caracteres' }, { status: 400 });
    }

    const searchedAt = new Date().toISOString();

    // 3 búsquedas en paralelo (3 llamadas de las 100/día gratis):
    // 1) general — lo que Google considere más relevante
    // 2) "comprar" en dominios .es/.eu — tiendas orientadas a España
    // 3) misma query pero en dominios de países lowkey — para sacar
    //    boutiques pequeñas que nunca aparecerían en la búsqueda normal
    const lowkeySites = LOWKEY_TLDS.map((tld) => `site:.${tld}`).join(' OR ');

    const [general, buying, lowkey] = await Promise.allSettled([
      googleSearch(query, ''),
      googleSearch(query, 'comprar site:es OR site:eu'),
      googleSearch(`${query} (${lowkeySites})`, '', { rawQuery: true }),
    ]);

    const raw = [
      ...(general.status === 'fulfilled' ? general.value : []),
      ...(buying.status === 'fulfilled' ? buying.value : []),
      ...(lowkey.status === 'fulfilled' ? lowkey.value : []),
    ];

    // Deduplicar por URL y quitar reventa/agregadores
    const seen = new Set<string>();
    const unique = raw.filter((r) => {
      if (seen.has(r.url) || shouldSkipDomain(r.url)) return false;
      seen.add(r.url);
      return true;
    });

    // Scrape en paralelo (limitado a 14 para no pasarnos del timeout)
    const batch = unique.slice(0, 14);
    const scraped = await Promise.all(
      batch.map(async (item) => {
        const details = await scrapeProduct(item.url, query);
        return { ...item, ...details };
      })
    );

    const results = scraped.map((r) => {
      const priceCheck = checkPriceAgainstRetail(`${query} ${r.title}`, r.price);

      // Si el precio se sale mucho del rango retail conocido, no lo
      // tratamos como "exacto" aunque tenga el SKU — probablemente sea
      // reventa camuflada de tienda normal, o un error de scraping.
      const priceLooksReal = priceCheck.anomaly === 'none';

      const confidence =
        r.skuFound && r.price && priceLooksReal ? 0.95 :
        r.skuFound && r.price && !priceLooksReal ? 0.55 :
        r.skuFound ? 0.75 :
        0.40;

      const matchType =
        r.skuFound && r.price && priceLooksReal ? 'exact' :
        r.skuFound ? 'probable' :
        'possible';

      return {
        title: r.title,
        url: r.url,
        displayUrl: r.displayUrl,
        snippet: r.snippet,
        price: r.price,
        currency: r.currency ?? 'EUR',
        availability: r.availability,
        matchType,
        confidence,
        priceAnomaly: priceCheck.anomaly, // 'none' | 'below' | 'above'
        expectedRetail: priceCheck.expected,
      };
    });

    results.sort((a, b) => b.confidence - a.confidence);

    return NextResponse.json({ query, searchedAt, results });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? 'Error interno' },
      { status: 500 }
    );
  }
}
