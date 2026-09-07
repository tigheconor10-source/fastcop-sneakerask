/**
 * lib/sneakerask.ts
 * ─────────────────────────────────────────────────────────────
 * Cliente de la Seller API v1.0 de sneakerask — la que le dieron a Conor
 * como vendedor/socio autorizado. Gestiona SUS PROPIOS anuncios dentro
 * de la plataforma de sneakerask (buscar catálogo, crear/actualizar
 * anuncios, listar los suyos, borrar). No sirve para nada fuera de eso.
 * ─────────────────────────────────────────────────────────────
 */

const BASE = "https://api.sneakerask.com/api/seller-v1";

function headers(extra: Record<string, string> = {}) {
  const auth = process.env.SNEAKERASK_AUTH_KEY;
  const appKey = process.env.SNEAKERASK_APP_KEY;
  if (!auth || !appKey) {
    throw new Error("Faltan SNEAKERASK_AUTH_KEY / SNEAKERASK_APP_KEY en las variables de entorno");
  }
  return {
    Authorization: `Bearer ${auth}`,
    "X-App-Key": appKey,
    Accept: "application/json",
    ...extra,
  };
}

async function sneakerFetch(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: headers(init.headers as any) });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (res.status === 429) {
    // Rate limit — la doc pide backoff en vez de reintentar a lo loco
    // (insistir puede acabar en bloqueo de IP). Un solo reintento tras
    // esperar Retry-After (o 2s si no viene).
    const retryAfter = Number(res.headers.get("Retry-After") ?? "2");
    await new Promise((r) => setTimeout(r, Math.min(retryAfter, 10) * 1000));
    return sneakerFetch(path, init);
  }
  if (!res.ok || json?.success === false) {
    throw new Error(`sneakerask ${init.method || "GET"} ${path} -> ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

export type SneakeraskSize = {
  size: string;
  listing_exists: boolean;
  listing_id: number | null;
  lowest_standard_ask: number | null;
  lowest_express_ask: number | null;
};

export type SneakeraskProduct = {
  id: number;
  title: string;
  sku: string;
  brand: string;
  image: string | null;
  sizes: SneakeraskSize[];
};

// ⚠️ MIGRACIÓN (Seller API v1.3, septiembre 2026):
// GET /seller-variant-listings/products (el que usaban search y detail
// de aquí abajo, con ?search= o ?product_id=) se DESCONTINUÓ el 1 de
// septiembre de 2026. El reemplazo es POST /seller-variant-listings/
// products-batch, y con una diferencia importante: YA NO admite texto
// libre/parcial — solo acepta EXACTO por uno de ids[]/skus[]/titles[]
// (uno de los tres, máximo 50 valores). "Buscar por marca" o un trozo
// de nombre ya no es posible contra esta API.
//
// Tampoco documenta un campo "image" en su respuesta de ejemplo (antes
// sí venía) — se sigue intentando leer por si lo manda sin documentar,
// pero puede que sneakerask haya quitado las fotos de esta API.
function mapBatchItem(p: any): SneakeraskProduct {
  return {
    id: Number(p.id),
    title: p.title ?? "",
    sku: p.sku ?? "",
    brand: p.brand ?? "",
    image: p.image ?? p.picture ?? p.image_url ?? null,
    sizes: (p.sizes ?? []).map((s: any) => ({
      size: String(s.size ?? ""),
      listing_exists: Boolean(s.listing_exists),
      listing_id: s.listing_id ?? null,
      lowest_standard_ask: s.lowest_standard_ask != null ? Number(s.lowest_standard_ask) : null,
      lowest_express_ask: s.lowest_express_ask != null ? Number(s.lowest_express_ask) : null,
    })),
  };
}

function looksLikeSku(s: string): boolean {
  return /^[A-Z0-9]{4,}-?[A-Z0-9]{2,}$/i.test(s.trim());
}

/** Busca por SKU o título EXACTO — ya NO admite texto libre/parcial (ver
 *  aviso arriba). Si el texto parece un SKU se manda como skus[], si no
 *  como titles[]. products-batch no devuelve metadato de paginación, así
 *  que "hasMore" es una estimación (si volvió una página llena, puede
 *  que haya más). */
export async function searchSneakeraskProducts(query: string, page = 1): Promise<{ items: SneakeraskProduct[]; hasMore: boolean }> {
  const perPage = 20;
  const by = looksLikeSku(query) ? "skus" : "titles";
  const body = { [by]: [query.trim()], per_page: perPage, page };

  const json = await sneakerFetch(`/seller-variant-listings/products-batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const items = (json?.data?.items ?? []).map(mapBatchItem);
  return { items, hasMore: items.length >= perPage };
}

/** Detalle de UN producto por su product_id — ahora vía products-batch
 *  con ids[], ya no GET ?product_id= (esa ruta murió con el resto del
 *  endpoint viejo). */
export async function getSneakeraskProduct(productId: number): Promise<SneakeraskProduct | null> {
  const json = await sneakerFetch(`/seller-variant-listings/products-batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: [productId], per_page: 1, page: 1 }),
  });
  const items = json?.data?.items ?? [];
  return items[0] ? mapBatchItem(items[0]) : null;
}

export type OwnListing = {
  id: number;
  variant_key: string;
  quantity: number;
  price: number;
  is_best_listing: boolean;
  best_listing_type: string | null;
  status: string;
};

/** Tus propios anuncios activos/borrador. */
export async function getOwnListings(params: { search?: string; status?: string; page?: number } = {}): Promise<OwnListing[]> {
  const qs = new URLSearchParams();
  qs.set("per_page", "50");
  qs.set("page", String(params.page ?? 1));
  if (params.search) qs.set("search", params.search);
  if (params.status) qs.set("status", params.status);
  const json = await sneakerFetch(`/seller-variant-listings?${qs.toString()}`);
  // La doc de "Own Listings" avisa explícitamente: la forma real es
  // data.items + data.pagination, NUNCA data.data — este bug ya estaba
  // aquí antes del cambio de API, nada que ver con el endpoint muerto.
  return json?.data?.items ?? [];
}

/** Crea o actualiza (si ya existe esa talla para ese producto) un anuncio. */
export async function createOrUpdateListing(input: {
  productId: number;
  size: string;
  askPrice: number;
  quantity?: number;
  status?: "active" | "draft";
}): Promise<any> {
  return sneakerFetch(`/seller-variant-listings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      listings: [
        {
          product_id: input.productId,
          size: input.size,
          ask_price: input.askPrice,
          quantity: input.quantity ?? 1,
          status: input.status ?? "active",
        },
      ],
    }),
  });
}

/** Actualiza precio/cantidad/estado de un anuncio ya existente, por su id. */
export async function updateListing(
  listingId: number,
  changes: { price?: number; quantity?: number; status?: "active" | "draft" }
): Promise<any> {
  return sneakerFetch(`/seller-variant-listings/${listingId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  });
}

export async function deleteListings(ids: number[]): Promise<any> {
  return sneakerFetch(`/seller-variant-listings`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
}
