/**
 * Intenta extraer precio y disponibilidad de una URL de tienda.
 * Usa JSON-LD (schema.org) como primera opción — lo incluyen la mayoría
 * de tiendas modernas (Shopify, PrestaShop, WooCommerce) para SEO.
 * Si no hay JSON-LD, devuelve null en precio/stock (no inventamos nada).
 */
export type ScrapeResult = {
  price: number | null;
  currency: string | null;
  availability: 'in_stock' | 'out_of_stock' | 'unknown';
  skuFound: boolean;
};

export async function scrapeProduct(url: string, sku: string): Promise<ScrapeResult> {
  const empty: ScrapeResult = { price: null, currency: null, availability: 'unknown', skuFound: false };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return empty;
    const html = await res.text();

    // Buscar si el SKU aparece literalmente en la página
    const skuFound = sku.length > 4 && html.toLowerCase().includes(sku.toLowerCase());

    // Extraer JSON-LD
    const ldMatches = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
    for (const match of ldMatches) {
      try {
        const json = JSON.parse(match[1]);
        const items = Array.isArray(json) ? json : [json];
        for (const item of items) {
          if (item['@type'] !== 'Product') continue;
          const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
          if (!offer) continue;

          const price = parseFloat(offer.price);
          const currency = offer.priceCurrency ?? null;
          const avail = (offer.availability ?? '').toLowerCase();
          const availability =
            avail.includes('instock') ? 'in_stock' :
            avail.includes('outofstock') ? 'out_of_stock' :
            'unknown';

          return { price: isNaN(price) ? null : price, currency, availability, skuFound };
        }
      } catch {}
    }

    return { ...empty, skuFound };
  } catch {
    return empty;
  }
}
