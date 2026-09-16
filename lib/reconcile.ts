import { createAdminClient } from "@/lib/supabase/server";
import { consignVariant, delistVariant } from "@/lib/shopify";

type LeavingProduct = {
  id: string;
  shopify_product_id: string | null;
  shopify_variant_id: string | null;
  original_price: number | null;
  original_sku: string | null;
};

/**
 * Se llama SIEMPRE que un listing deja de estar activo para una talla
 * (el seller lo retira, se pausa por vacaciones, o se vende) — ANTES de
 * eso pasaba: si dos consignadores tenían la MISMA talla publicada a la
 * vez, y el que tenía el precio activo en Shopify la quitaba, el precio
 * se quedaba "congelado" en el suyo aunque el otro consignador siguiera
 * con su listing publicado detrás.
 *
 * Esto comprueba si queda OTRO consignador con esa misma talla en estado
 * "published" — si lo hay, se reaplica SU precio (el más barato entre
 * los que queden, con su propio 48h si le corresponde) en vez de
 * resetear a la tienda. Solo si no queda nadie más se revierte de verdad
 * al precio original (delistVariant, como siempre).
 */
export async function reconcileVariantAfterDelist(
  leaving: LeavingProduct,
  fallbackPriceIfNoOriginal?: number
): Promise<void> {
  const productId = leaving.shopify_product_id;
  const variantId = leaving.shopify_variant_id;
  if (!productId || !variantId) return;

  const admin = createAdminClient();

  const { data: rows } = await admin
    .from("products")
    .select("id, consignor_id, desired_price, shopify_product_id, shopify_variant_id")
    .eq("shopify_variant_id", variantId)
    .eq("status", "published")
    .neq("id", leaving.id)
    .order("desired_price", { ascending: true })
    .limit(1);

  const nextBest = rows?.[0] as
    | {
        id: string;
        consignor_id: string;
        desired_price: number;
        shopify_product_id: string;
        shopify_variant_id: string;
      }
    | undefined;

  if (nextBest) {
    const { data: profile } = await admin
      .from("profiles")
      .select("discord_id")
      .eq("id", nextBest.consignor_id)
      .maybeSingle();

    await consignVariant({
      productId: nextBest.shopify_product_id,
      variantId: nextBest.shopify_variant_id,
      payout: nextBest.desired_price,
      discordId: (profile as { discord_id: string | null } | null)?.discord_id ?? null,
      consignorId: nextBest.consignor_id,
      internalProductId: nextBest.id,
    });
    return;
  }

  // Nadie más activo para esta talla — sí, revertir al precio de la tienda.
  await delistVariant(productId, variantId, leaving.original_price ?? fallbackPriceIfNoOriginal ?? 0, leaving.original_sku);
}
