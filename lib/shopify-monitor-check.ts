// Comprueba un producto de una tienda Shopify usando su endpoint público
// {store}/products/{handle}.json — no hace falta API key ni autenticación,
// es la misma data que usa el propio storefront.
export type ShopifyCheckResult = {
  title: string | null;
  price: string | null;
  variants: { id: number; title: string; price: string; available: boolean }[];
  anyAvailable: boolean;
};

export async function checkShopifyProduct(storeDomain: string, handle: string): Promise<ShopifyCheckResult> {
  const url = `https://${storeDomain}/products/${handle}.json`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  let json: any;
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    json = await res.json();
  } finally {
    clearTimeout(timeout);
  }

  const product = json?.product;
  if (!product) throw new Error('Respuesta sin producto (¿handle correcto?)');

  const variants = (product.variants ?? []).map((v: any) => ({
    id: v.id,
    title: v.title,
    price: v.price,
    available: Boolean(v.available),
  }));

  const anyAvailable = variants.some((v: any) => v.available);
  const price = variants[0]?.price ?? null;

  return { title: product.title ?? null, price, variants, anyAvailable };
}
