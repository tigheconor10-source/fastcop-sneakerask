import { NextResponse } from "next/server";

const STOCKX_TOKEN_URL = "https://accounts.stockx.com/oauth/token";
const STOCKX_BASE = "https://api.stockx.com/v2";
const AUDIENCE = "gateway.stockx.com";

let cachedToken: { token: string; exp: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.token;
  const res = await fetch(STOCKX_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: process.env.STOCKX_CLIENT_ID,
      client_secret: process.env.STOCKX_CLIENT_SECRET,
      refresh_token: process.env.STOCKX_REFRESH_TOKEN,
      audience: AUDIENCE,
    }),
  });
  if (!res.ok) throw new Error(`StockX auth failed: ${res.status}`);
  const d = await res.json();
  cachedToken = { token: d.access_token, exp: Date.now() + (d.expires_in ?? 3600) * 1000 };
  return cachedToken.token;
}

async function sxFetch(path: string): Promise<any> {
  const token = await getToken();
  const res = await fetch(`${STOCKX_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-api-key": process.env.STOCKX_API_KEY!,
    },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`StockX ${res.status} ${path}`);
  return res.json();
}

// GET /api/barcode?code=194502876024
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code")?.trim();
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });

  try {
    // 1. Buscar en StockX por el barcode como query
    const searchData = await sxFetch(
      `/catalog/search?query=${encodeURIComponent(code)}&pageNumber=1&pageSize=5`
    );
    const products = searchData.products ?? [];

    if (products.length === 0) {
      return NextResponse.json({ error: "not_found", barcode: code }, { status: 404 });
    }

    // 2. Para cada producto encontrado, buscar sus variants y ver si algún GTIN coincide
    for (const product of products) {
      try {
        const variantsData = await sxFetch(`/catalog/products/${product.productId}/variants`);
        const variants = variantsData.data ?? variantsData ?? [];

        for (const v of variants) {
          const gtins: { identifier: string; type: string }[] = v.gtins ?? [];
          const match = gtins.find(
            (g) =>
              g.identifier === code ||
              g.identifier === `00${code}` || // ITF-14 prefix
              g.identifier.replace(/^0+/, "") === code.replace(/^0+/, "")
          );

          if (match) {
            // Encontrado — devolvemos styleId + talla EU para pre-seleccionar
            const euConversion = v.sizeChart?.availableConversions?.find(
              (c: any) => c.type === "eu"
            );
            const euSize = euConversion?.size?.replace(/[^0-9.]/g, "") ?? null;

            return NextResponse.json({
              found: true,
              styleId: product.styleId,
              productName: product.title,
              brand: product.brand,
              euSize,
              barcode: code,
              variantId: v.variantId,
            });
          }
        }
      } catch {
        // Si falla un producto, continúa con el siguiente
        continue;
      }
    }

    // 3. No se encontró GTIN exacto — devolver el primer resultado con styleId
    // para que busque en Shopify por SKU igualmente
    const first = products[0];
    return NextResponse.json({
      found: true,
      styleId: first.styleId,
      productName: first.title,
      brand: first.brand,
      euSize: null,
      barcode: code,
      variantId: null,
      approximate: true,
    });
  } catch (err: any) {
    console.error("[/api/barcode]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
