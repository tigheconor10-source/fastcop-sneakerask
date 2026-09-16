// Funciones para comunicarse con la Admin API de Shopify.
// Enfoque: NUNCA creamos productos nuevos. Cada modelo+talla ya existe como
// variante de un producto en fastcopstore.com (importado de tu catálogo).
// "Consignar" = actualizar el precio de esa variante y marcarla con
// metacampos (is_consigned, agreed_price, username_consigner,
// 24h_shipping_consigners). "Deslistar" = revertirlo.

import { calculateSellingPrice } from "./pricing";
import type { ShopifyCatalogItem } from "./types";

const SHOPIFY_API_VERSION = "2024-01";

// El "rey": cuando este discord_id consigna una talla, además de la
// consignación normal, se marca custom.48h_shipping=true en esa VARIANTE
// (no solo en el producto). Esa marca a nivel de variante es la que hace
// que searchShopifyCatalog excluya esa talla concreta para TODOS los demás
// consignadores - así el rey siempre tiene prioridad para vender primero lo
// que él mismo consigna. Para cualquier otro discord_id, este metacampo de
// variante nunca se activa.
const KING_DISCORD_ID = "805869138710233108";

function shopifyGraphqlUrl() {
  return `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
}

function shopifyHeaders() {
  return {
    "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_ACCESS_TOKEN!,
    "Content-Type": "application/json",
  };
}

async function shopifyGraphql<T = any>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(shopifyGraphqlUrl(), {
    method: "POST",
    headers: shopifyHeaders(),
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`Shopify API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  if (data.errors) {
    throw new Error(`Shopify API error: ${JSON.stringify(data.errors)}`);
  }

  return data.data as T;
}

// Marcas conocidas, de más a menos específica (para separar "marca" del resto
// del título, p.ej. "New Balance 2002R..." -> brand="New Balance").
const KNOWN_BRANDS = [
  "New Balance",
  "On Running",
  "Air Jordan",
  "ASICS",
  "Nike",
  "adidas",
  "Jordan",
  "Yeezy",
  "Saucony",
  "Salomon",
  "Puma",
  "Reebok",
  "Converse",
  "Vans",
];

function splitBrandModel(title: string): { brand: string; model: string } {
  for (const brand of KNOWN_BRANDS) {
    if (title.toLowerCase().startsWith(brand.toLowerCase() + " ")) {
      return { brand, model: title.slice(brand.length + 1).trim() };
    }
  }
  const parts = title.split(" ");
  return { brand: parts[0] ?? "", model: parts.slice(1).join(" ") || title };
}

// Productos cuyo productType contiene "Essentials" nunca son listables
// (son sets/camisetas sin SKU real de catálogo - el SKU es solo el título).
function isEssentialsProduct(productType: string): boolean {
  return productType.toLowerCase().includes("essentials");
}

// Busca productos en vivo en fastcopstore.com (vía Admin GraphQL) y devuelve,
// para cada uno, el precio actual, el ID de variante y el SKU por talla EU.
// Solo se incluyen tallas que tengan un SKU real (no vacío) - sin SKU no se
// puede consignar, porque no hay nada que "ocultar" del bot de precios.
// Si el producto es de tipo "Essentials", se marca isEssentials=true y no
// se devuelve ninguna talla (no es listable en absoluto).
export async function searchShopifyCatalog(query: string): Promise<ShopifyCatalogItem[]> {
  const data = await shopifyGraphql<{
    products: { edges: { node: any }[] };
  }>(
    `query SearchCatalog($q: String!) {
      products(first: 8, query: $q) {
        edges {
          node {
            id
            title
            productType
            featuredMedia {
              preview { image { url } }
            }
            variants(first: 50) {
              edges {
                node {
                  id
                  title
                  price
                  sku
                  ownerStock: metafield(namespace: "custom", key: "48h_shipping") {
                    value
                  }
                }
              }
            }
          }
        }
      }
    }`,
    { q: query }
  );

  const edges = data.products?.edges ?? [];

  return edges.map((edge) => {
    const node = edge.node;
    const variants = (node.variants?.edges ?? []).map((e: any) => e.node);
    const essentials = isEssentialsProduct(node.productType ?? "");

    const prices: Record<string, number> = {};
    const variantIds: Record<string, string> = {};
    const variantSkus: Record<string, string> = {};

    if (!essentials) {
      // Todas las tallas de un mismo modelo/colorway comparten el mismo SKU
      // base (confirmado: ASICS Gel-NYC 36-39 tienen todas "1203A383-106").
      // Si una talla concreta está consignada por OTRO seller, su SKU está
      // vacío ahora mismo - pero usamos el SKU de una talla hermana que
      // siga teniéndolo, para poder seguir ofreciendo esa talla aquí.
      const sharedSku =
        variants.find((v: any) => (v.sku ?? "").trim())?.sku?.trim() ?? "";

      if (sharedSku) {
        for (const v of variants) {
          const price = Number(v.price);
          // custom.48h_shipping=true en esta variante significa que el
          // "rey" (TÚ, identificado por KING_DISCORD_ID) ya tiene ese par
          // consignado/en casa listo para enviar en 48h - quiere venderlo
          // él primero, así que esa talla no se ofrece a otros
          // consignadores aunque el resto del modelo sí.
          const ownedByStore = v.ownerStock?.value === "true";
          if (v.title && !Number.isNaN(price) && !ownedByStore) {
            prices[v.title] = price;
            variantIds[v.title] = v.id;
            variantSkus[v.title] = sharedSku;
          }
        }
      }
    }

    const firstSku = variants.find((v: any) => (v.sku ?? "").trim())?.sku ?? "";
    const { brand, model } = splitBrandModel(node.title ?? "");
    return {
      sku: firstSku,
      name: model,
      brand,
      image_url: node.featuredMedia?.preview?.image?.url ?? "",
      productId: node.id,
      prices,
      variantIds,
      variantSkus,
      isEssentials: essentials,
    };
  });
}

// Algunos listados se crearon con la versión anterior (REST), que guardaba
// IDs numéricos planos en vez de GIDs. La API GraphQL necesita GIDs
// ("gid://shopify/Product/123"), así que normalizamos aquí.
export function toGid(resource: "Product" | "ProductVariant", id: string): string {
  if (id.startsWith("gid://")) return id;
  return `gid://shopify/${resource}/${id}`;
}

// El webhook orders/create (REST) manda variant_id como número plano, pero
// nuestras filas pueden tener GIDs ("gid://shopify/ProductVariant/123") o
// números planos según cuándo se crearon. Esto extrae solo el número final
// para poder comparar ambos lados de forma fiable.
export function extractNumericId(id: string): string {
  return id.split("/").pop() ?? id;
}

const VARIANT_BULK_UPDATE_MUTATION = `
  mutation ConsignVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      productVariants { id price }
      userErrors { field message }
    }
  }
`;

type VariantBulkUpdateResult = {
  productVariantsBulkUpdate: {
    productVariants: { id: string; price: string }[];
    userErrors: { field: string[]; message: string }[];
  };
};

async function bulkUpdateVariant(
  productId: string,
  variantId: string,
  price: number,
  metafields: { namespace: string; key: string; type: string; value: string }[],
  sku?: string // si se pasa, actualiza también el SKU de la variante (inventoryItem.sku)
) {
  const variantInput: Record<string, unknown> = {
    id: variantId,
    price: price.toFixed(2),
    metafields,
  };

  if (sku !== undefined) {
    variantInput.inventoryItem = { sku };
  }

  const data = await shopifyGraphql<VariantBulkUpdateResult>(VARIANT_BULK_UPDATE_MUTATION, {
    productId,
    variants: [variantInput],
  });

  const errors = data.productVariantsBulkUpdate.userErrors;
  if (errors.length > 0) {
    throw new Error(`Shopify variant update error: ${JSON.stringify(errors)}`);
  }
}

const PRODUCT_METAFIELDS_SET_MUTATION = `
  mutation SetProductShippingBadge($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id value }
      userErrors { field message }
    }
  }
`;

type MetafieldsSetResult = {
  metafieldsSet: {
    metafields: { id: string; value: string }[];
    userErrors: { field: string[]; message: string }[];
  };
};

// Escribe custom.48h_shipping a nivel de PRODUCTO (no de variante). Este es
// el metacampo que controla el badge "48H" visible en el grid de
// colecciones del storefront. Se activa en cuanto cualquier variante del
// producto queda consignada, y solo se desactiva cuando ya no queda
// ninguna variante consignada activa (ver countOtherActive48hVariants).
export async function setProductShippingBadge(productId: string, value: boolean) {
  const gid = toGid("Product", productId);
  const data = await shopifyGraphql<MetafieldsSetResult>(PRODUCT_METAFIELDS_SET_MUTATION, {
    metafields: [
      {
        ownerId: gid,
        namespace: "custom",
        key: "48h_shipping",
        type: "boolean",
        value: value ? "true" : "false",
      },
    ],
  });

  const errors = data.metafieldsSet.userErrors;
  if (errors.length > 0) {
    throw new Error(`Shopify product metafield error: ${JSON.stringify(errors)}`);
  }
}

// Cuenta cuántas OTRAS variantes (excluyendo excludingVariantId) del mismo
// producto siguen teniendo custom.24h_shipping_consigners=true. Se usa al
// deslistar una variante para decidir si el badge 48h_shipping del PRODUCTO
// debe apagarse (solo si esta era la última variante activa) o debe
// quedarse encendido (si otras tallas siguen consignadas).
export async function countOtherActive48hVariants(
  productId: string,
  excludingVariantId: string
): Promise<number> {
  const productGid = toGid("Product", productId);
  const excludingGid = toGid("ProductVariant", excludingVariantId);

  const data = await shopifyGraphql<{
    product: {
      variants: { edges: { node: { id: string; consigned: { value: string } | null } }[] };
    } | null;
  }>(
    `query CountActive48hVariants($id: ID!) {
      product(id: $id) {
        variants(first: 100) {
          edges {
            node {
              id
              consigned: metafield(namespace: "custom", key: "24h_shipping_consigners") {
                value
              }
            }
          }
        }
      }
    }`,
    { id: productGid }
  );

  const variants = data.product?.variants?.edges ?? [];
  return variants.filter(
    (e) => e.node.id !== excludingGid && e.node.consigned?.value === "true"
  ).length;
}

type ConsignParams = {
  productId: string; // GID del producto (compartido entre tallas/consignadores)
  variantId: string; // GID de la variante (talla concreta)
  payout: number;
  discordId: string | null;
  consignorId: string; // id interno del consignador (de Supabase)
  internalProductId: string; // id interno de la fila en "products" (de Supabase)
};

// Marca una variante existente como consignada: actualiza su precio al
// precio de venta (payout + tarifa), rellena los metacampos que identifican
// al consignador y el precio acordado, Y VACÍA EL SKU de la variante.
//
// Por qué vaciamos el SKU: Fastcop tiene un bot que actualiza precios según
// el mercado buscando por SKU. Si el SKU sigue ahí, el bot sobrescribiría el
// precio acordado con el consignador en la siguiente pasada. Al vaciar el
// SKU, el bot no encuentra/matchea esa variante y la deja en paz mientras
// está consignada. El SKU original se guarda en nuestra base de datos
// (products.original_sku) y se restaura al deslistar/vender.
//
// Si quien consigna es el "rey" (KING_DISCORD_ID), además se marca
// custom.48h_shipping=true en la PROPIA VARIANTE - eso hace que
// searchShopifyCatalog excluya esa talla para cualquier otro consignador
// (prioridad de venta para el rey). Para cualquier otro discord_id, ese
// metacampo de variante nunca se toca.
export async function consignVariant(params: ConsignParams) {
  const sellingPrice = calculateSellingPrice(params.payout);
  if (sellingPrice === null) {
    throw new Error(`Payout (€${params.payout}) is below the minimum allowed (€50).`);
  }

  const isKing = params.discordId === KING_DISCORD_ID;

  const metafields = [
    { namespace: "custom", key: "is_consigned", type: "boolean", value: "true" },
    {
      namespace: "custom",
      key: "agreed_price",
      type: "single_line_text_field",
      value: params.payout.toFixed(2),
    },
    {
      namespace: "custom",
      key: "username_consigner",
      type: "single_line_text_field",
      value: params.discordId || "0",
    },
    { namespace: "custom", key: "24h_shipping_consigners", type: "boolean", value: "true" },
    {
      namespace: "consignment",
      key: "internal_product_id",
      type: "single_line_text_field",
      value: params.internalProductId,
    },
    {
      namespace: "consignment",
      key: "consignor_id",
      type: "single_line_text_field",
      value: params.consignorId,
    },
  ];

  if (isKing) {
    metafields.push({ namespace: "custom", key: "48h_shipping", type: "boolean", value: "true" });
  }

  await bulkUpdateVariant(
    toGid("Product", params.productId),
    toGid("ProductVariant", params.variantId),
    sellingPrice,
    metafields,
    "" // vaciar el SKU
  );

  // El badge "48H" a nivel de PRODUCTO se activa siempre que cualquier
  // variante quede consignada, sea o no el rey quien la consigna.
  await setProductShippingBadge(params.productId, true);
}

// Actualiza el payout de una variante YA consignada: cambia el precio de
// venta y el metacampo custom.agreed_price, sin tocar el resto.
export async function updateConsignedVariantPrice(
  productId: string,
  variantId: string,
  newPayout: number
) {
  const sellingPrice = calculateSellingPrice(newPayout);
  if (sellingPrice === null) {
    throw new Error(`Payout (€${newPayout}) is below the minimum allowed (€50).`);
  }

  await bulkUpdateVariant(
    toGid("Product", productId),
    toGid("ProductVariant", variantId),
    sellingPrice,
    [
      {
        namespace: "custom",
        key: "agreed_price",
        type: "single_line_text_field",
        value: newPayout.toFixed(2),
      },
    ]
  );
}

// Deslista una variante: restaura su precio original, restaura su SKU
// original (para que el bot de precios vuelva a gestionarla) y limpia TODOS
// los metacampos de consignación (is_consigned=false, etc), incluyendo
// custom.48h_shipping a nivel de VARIANTE si la había puesto el rey.
//
// Se usa en 3 sitios: cuando el seller pulsa "Remove", cuando se activa
// vacation mode, y cuando el webhook de Shopify detecta que la variante se
// vendió (en ese caso el "ask" debe desaparecer por completo).
export async function delistVariant(
  productId: string,
  variantId: string,
  originalPrice: number,
  originalSku: string | null
) {
  await bulkUpdateVariant(
    toGid("Product", productId),
    toGid("ProductVariant", variantId),
    originalPrice,
    [
      { namespace: "custom", key: "is_consigned", type: "boolean", value: "false" },
      { namespace: "custom", key: "24h_shipping_consigners", type: "boolean", value: "false" },
      { namespace: "custom", key: "agreed_price", type: "single_line_text_field", value: "0" },
      // OJO: Shopify RECHAZA value="" en metacampos de texto con
      // "Value no puede estar en blanco" (confirmado contra la API real).
      // Usamos "0" como valor "vacío"/sentinela para estos campos.
      { namespace: "custom", key: "username_consigner", type: "single_line_text_field", value: "0" },
      { namespace: "custom", key: "48h_shipping", type: "boolean", value: "false" },
      { namespace: "consignment", key: "internal_product_id", type: "single_line_text_field", value: "0" },
      { namespace: "consignment", key: "consignor_id", type: "single_line_text_field", value: "0" },
    ],
    originalSku ?? "" // restaurar el SKU original para que el bot vuelva a gestionarlo
  );

  // Poner stock a 0 YA — no dejar que la web siga vendiendo un par que ya
  // no está físicamente disponible. Si esto falla, no rompemos el resto
  // del deslistado (precio y metacampos ya se aplicaron bien), pero se deja
  // constancia en los logs de Vercel para poder revisarlo.
  try {
    await setVariantInventoryZero(variantId);
  } catch (err) {
    console.error(`No se pudo poner el stock a 0 para variant ${variantId}:`, err);
  }

  // Si esta era la última variante activa consignada del producto, apagamos
  // el badge "48H" a nivel de producto. Si otras tallas siguen consignadas,
  // lo dejamos encendido.
  const stillActive = await countOtherActive48hVariants(productId, variantId);
  if (stillActive === 0) {
    await setProductShippingBadge(productId, false);
  }
}

let _firstLocationId: string | null = null;

async function getFirstLocationId(): Promise<string> {
  if (_firstLocationId) return _firstLocationId;
  const data = await shopifyGraphql<{ locations: { nodes: { id: string }[] } }>(
    `query { locations(first: 1) { nodes { id } } }`,
    {}
  );
  const id = data.locations.nodes[0]?.id;
  if (!id) throw new Error("No se encontró ninguna ubicación en Shopify");
  _firstLocationId = id;
  return id;
}

// Pone el stock disponible de una variante a 0 en la ubicación principal.
// Se usa al deslistar (ver delistVariant) para que el par deje de ser
// comprable en la web al instante, sin depender de otro sistema externo.
export async function setVariantInventoryZero(variantId: string): Promise<void> {
  const variantGid = toGid("ProductVariant", variantId);

  const variantData = await shopifyGraphql<{
    productVariant: { inventoryItem: { id: string } } | null;
  }>(
    `query GetInventoryItem($id: ID!) {
      productVariant(id: $id) {
        inventoryItem { id }
      }
    }`,
    { id: variantGid }
  );

  const inventoryItemId = variantData.productVariant?.inventoryItem?.id;
  if (!inventoryItemId) return;

  const locationId = await getFirstLocationId();

  const data = await shopifyGraphql<{
    inventorySetQuantities: { userErrors: { field: string[]; message: string }[] };
  }>(
    `mutation SetZeroStock($input: InventorySetQuantitiesInput!) {
      inventorySetQuantities(input: $input) {
        userErrors { field message }
      }
    }`,
    {
      input: {
        name: "available",
        reason: "correction",
        ignoreCompareQuantity: true,
        quantities: [{ inventoryItemId, locationId, quantity: 0 }],
      },
    }
  );

  const errs = data.inventorySetQuantities.userErrors;
  if (errs.length > 0) {
    throw new Error(`Shopify inventorySetQuantities error: ${JSON.stringify(errs)}`);
  }
}