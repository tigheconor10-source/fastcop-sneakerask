const UA_LIST = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
];

function randomUA() { return UA_LIST[Math.floor(Math.random() * UA_LIST.length)]; }

function extractByCss(html: string, selector: string): string | null {
  if (!selector || !html) return null;
  const classParts = selector.match(/\.([a-zA-Z0-9_-]+)/g);
  const tagPart = selector.match(/^[a-zA-Z0-9]+/)?.[0] ?? '[a-zA-Z]+';
  const attrPattern = classParts
    ? classParts.map((c) => `[^>]*class="[^"]*${c.slice(1)}[^"]*"`).join('')
    : '';
  const regex = new RegExp(`<${tagPart}${attrPattern}[^>]*>([\\s\\S]*?)<\\/${tagPart}>`, 'i');
  const m = html.match(regex);
  if (!m) return null;
  return m[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&euro;/g, '€').replace(/\s+/g, ' ').trim();
}

function extractJsonLd(html: string) {
  const ms = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const m of ms) {
    try {
      const json = JSON.parse(m[1]);
      const items = Array.isArray(json) ? json : [json];
      for (const item of items) {
        if (item['@type'] !== 'Product') continue;
        const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
        if (!offer) continue;
        return {
          price: `${offer.priceCurrency ?? '€'} ${offer.price}`.trim(),
          stock: (offer.availability ?? '').toLowerCase().includes('instock') ? 'in stock' : 'out of stock',
          name: item.name ?? null,
        };
      }
    } catch {}
  }
  return null;
}

export async function scrapeMonitorUrl(url: string, priceSelector = '.current-price', stockSelector: string | null = null) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18_000);
  let html: string;
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': randomUA(), 'Accept': 'text/html', 'Accept-Language': 'es-ES,es;q=0.9' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } finally { clearTimeout(timeout); }

  const ld = extractJsonLd(html);
  if (ld?.price) return { price: ld.price, stock: ld.stock, name: ld.name, method: 'json-ld' };

  const price = extractByCss(html, priceSelector);
  const stock = stockSelector ? extractByCss(html, stockSelector) : null;
  const name = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1]?.trim() ?? null;
  return { price, stock, name, method: 'css' };
}
