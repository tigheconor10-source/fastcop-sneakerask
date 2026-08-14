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

/** Busca en el catálogo de sneakerask por SKU/título/marca. */
export async function searchSneakeraskProducts(query: string, page = 1): Promise<{ items: SneakeraskProduct[]; hasMore: boolean }> {
  const json = await sneakerFetch(
    `/seller-variant-listings/products?per_page=20&page=${page}&search=${encodeURIComponent(query)}`
  );
  return {
    items: json?.data?.items ?? [],
    hasMore: !!json?.data?.pagination?.has_more_pages,
  };
}

/** Detalle de UN producto por su product_id (mismo endpoint, con product_id). */
export async function getSneakeraskProduct(productId: number): Promise<SneakeraskProduct | null> {
  const json = await sneakerFetch(`/seller-variant-listings/products?product_id=${productId}`);
  const items = json?.data?.items ?? [];
  return items[0] ?? null;
}

export type OwnListing = {
  id: number;
  productId: number | null;
  sku: string;
  title: string;
  brand: string | null;
  image: string | null;
  size: string;
  quantity: number;
  price: number;
  standardAsk: number | null;
  expressAsk: number | null;
  isBestListing: boolean;
  bestListingType: string | null;
  status: string;
  createdAt: string | null;
};

function mapOwnListing(row: any): OwnListing {
  return {
    id: row.id,
    productId: row.product_id ?? row.product?.product_id ?? null,
    sku: row.product?.catalogue?.sku ?? "",
    title: row.product?.title ?? "",
    brand: row.product?.vendor ?? null,
    image: row.product?.image ?? null,
    size: row.size ?? "",
    quantity: row.quantity ?? 1,
    price: Number(row.price),
    standardAsk: row.standard_ask != null ? Number(row.standard_ask) : null,
    expressAsk: row.express_ask != null ? Number(row.express_ask) : null,
    isBestListing: !!row.is_best_listing,
    bestListingType: row.best_listing_type ?? null,
    status: row.status ?? "active",
    createdAt: row.created_at ?? null,
  };
}

/** Tus propios anuncios activos/borrador. IMPORTANTE: la forma real de la
 *  respuesta es data.items + data.pagination (así lo dice la doc oficial),
 *  NO data.data — antes se leía mal y esta función siempre devolvía []
 *  sin avisar de ningún error, así que el vigilante nunca sabía de verdad
 *  si eras el mejor anuncio. */
export async function getOwnListings(
  params: { search?: string; status?: string; best?: boolean; sortBy?: string; page?: number; perPage?: number } = {}
): Promise<{ items: OwnListing[]; hasMore: boolean }> {
  const qs = new URLSearchParams();
  qs.set("per_page", String(params.perPage ?? 50));
  qs.set("page", String(params.page ?? 1));
  if (params.search) qs.set("search", params.search);
  if (params.status) qs.set("status", params.status);
  if (params.best !== undefined) qs.set("best", String(params.best));
  if (params.sortBy) qs.set("sort_by", params.sortBy);
  const json = await sneakerFetch(`/seller-variant-listings?${qs.toString()}`);
  return {
    items: (json?.data?.items ?? []).map(mapOwnListing),
    hasMore: !!json?.data?.pagination?.has_more_pages,
  };
}

/** Trae TODAS tus páginas de anuncios propios de golpe (para importar). */
export async function getAllOwnListings(status?: string): Promise<OwnListing[]> {
  const all: OwnListing[] = [];
  let page = 1;
  while (true) {
    const { items, hasMore } = await getOwnListings({ status, page, perPage: 50 });
    all.push(...items);
    if (!hasMore || items.length === 0) break;
    page++;
    if (page > 20) break; // límite de seguridad, 1000 anuncios
  }
  return all;
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
