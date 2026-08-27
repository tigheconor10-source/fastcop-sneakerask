import { googleSearch } from './google';
import { scrapeProduct } from './scraper';
import { shouldSkipDomain } from './blocked-domains';

const ASIA_TLDS = ['jp', 'kr', 'hk', 'sg', 'tw', 'th'];

export type AsiaSearchResultItem = {
  title: string;
  url: string;
  displayUrl: string;
  snippet: string;
  price: number | null;
  currency: string | null;
  availability: 'in_stock' | 'out_of_stock' | 'unknown';
  matchType: 'exact' | 'probable' | 'possible';
  confidence: number;
};

export async function runAsiaSearch(query: string): Promise<AsiaSearchResultItem[]> {
  const asiaSites = ASIA_TLDS.map((tld) => `site:.${tld}`).join(' OR ');

  const [general, asia] = await Promise.allSettled([
    googleSearch(query, '', {}),
    googleSearch(`${query} (${asiaSites})`, '', { rawQuery: true }),
  ]);

  const raw = [
    ...(general.status === 'fulfilled' ? general.value : []),
    ...(asia.status === 'fulfilled' ? asia.value : []),
  ];

  const seen = new Set<string>();
  const unique = raw.filter((r) => {
    if (seen.has(r.url) || shouldSkipDomain(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  const batch = unique.slice(0, 6);
  const scraped = await Promise.all(
    batch.map(async (item) => {
      const details = await scrapeProduct(item.url, query);
      return { ...item, ...details };
    })
  );

  const results: AsiaSearchResultItem[] = scraped.map((r) => {
    const confidence =
      r.skuFound && r.price ? 0.9 :
      r.skuFound ? 0.7 :
      0.4;

    const matchType: 'exact' | 'probable' | 'possible' =
      r.skuFound && r.price ? 'exact' :
      r.skuFound ? 'probable' :
      'possible';

    return {
      title: r.title,
      url: r.url,
      displayUrl: r.displayUrl,
      snippet: r.snippet,
      price: r.price,
      currency: r.currency ?? null,
      availability: r.availability,
      matchType,
      confidence,
    };
  });

  results.sort((a, b) => b.confidence - a.confidence);
  return results;
}
