export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  displayUrl: string;
  source: 'organic' | 'shopping';
};

/**
 * Busca en Google usando la Custom Search API.
 * query: lo que el usuario escribió (SKU, nombre, lo que sea)
 * site: si se quiere limitar a un dominio concreto (opcional)
 */
export async function googleSearch(query: string, extraTerms = '', opts: { rawQuery?: boolean } = {}): Promise<SearchResult[]> {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_CX;

  if (!apiKey || !cx) {
    throw new Error('Faltan GOOGLE_API_KEY o GOOGLE_CX en las variables de entorno');
  }

  const q = opts.rawQuery
    ? [query, extraTerms].filter(Boolean).join(' ').trim()
    : [query, extraTerms, 'comprar', 'stock'].filter(Boolean).join(' ').trim();

  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('cx', cx);
  url.searchParams.set('q', q);
  url.searchParams.set('num', '10');
  url.searchParams.set('gl', 'es'); // resultados orientados a España
  url.searchParams.set('hl', 'es');

  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Google API error ${res.status}: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  const items: any[] = data.items ?? [];

  return items.map((item) => ({
    title: item.title ?? '',
    url: item.link ?? '',
    snippet: item.snippet ?? '',
    displayUrl: item.displayLink ?? '',
    source: 'organic' as const,
  }));
}
