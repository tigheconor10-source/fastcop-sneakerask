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
  return json?.data?.data ?? [];
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
