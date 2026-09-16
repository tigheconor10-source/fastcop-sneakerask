import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { updateConsignedVariantPrice } from "@/lib/shopify";
import { maxPayoutForSellingPrice } from "@/lib/pricing";
import type { Product } from "@/lib/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Leer body primero (Next.js 15: el stream solo se puede consumir una vez)
  const body = await request.json().catch(() => null);
  const payoutPrice = body?.payoutPrice;

  if (typeof payoutPrice !== "number" || payoutPrice <= 0) {
    return NextResponse.json({ error: "Payout price must be greater than €0" }, { status: 400 });
  }

  const { id } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Usar admin client para saltar RLS — la autenticación ya se validó arriba
  // y el filtro .eq("consignor_id") garantiza que solo edita los suyos
  const admin = createAdminClient();
  const { data: productRow } = await admin
    .from("products")
    .select("*")
    .eq("id", id)
    .eq("consignor_id", userData.user.id)
    .maybeSingle();

  const product = productRow as Product | null;
  if (!product) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

  // Aceptar published Y pending — el seller puede editar el precio
  // desde el primer momento que sube el par
  if (!["published", "pending"].includes(product.status)) {
    return NextResponse.json({ error: "Can't edit price for this listing" }, { status: 400 });
  }

  if (product.original_price != null) {
    const maxPayout = maxPayoutForSellingPrice(product.original_price);
    if (maxPayout !== null && payoutPrice > maxPayout) {
      return NextResponse.json(
        { error: `Max payout is €${maxPayout.toFixed(2)} for this item` },
        { status: 400 }
      );
    }
  }

  // Actualizar en Shopify solo si ya está published (tiene variante activa)
  if (product.status === "published" && product.shopify_product_id && product.shopify_variant_id) {
    try {
      await updateConsignedVariantPrice(
        product.shopify_product_id,
        product.shopify_variant_id,
        payoutPrice
      );
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Shopify error" },
        { status: 500 }
      );
    }
  }

  // Guardar historial si el precio cambió (envuelto en try para no romper
  // si la tabla product_price_history todavía no existe en la BD)
  if (product.desired_price !== payoutPrice) {
    try {
      await admin.from("product_price_history").insert({
        product_id: product.id,
        consignor_id: userData.user.id,
        old_price: product.desired_price,
        new_price: payoutPrice,
      });
    } catch {} // tabla no existe todavía, ignorar
  }

  const { error: updateError } = await admin
    .from("products")
    .update({ desired_price: payoutPrice })
    .eq("id", id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
