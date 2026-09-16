import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { consignVariant } from "@/lib/shopify";
import type { Product, Profile } from "@/lib/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 1. Comprobar que quien llama es admin
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .single();

  if (!(profile as Profile)?.is_admin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // 2. Cargar el producto (con la service role, para evitar líos de RLS)
  const admin = createAdminClient();
  const { data: product, error } = await admin
    .from("products")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const p = product as Product;

  if (p.status !== "pending" && p.status !== "rejected") {
    return NextResponse.json(
      { error: "This product has already been published" },
      { status: 400 }
    );
  }

  const { data: consignorProfile } = await admin
    .from("profiles")
    .select("discord_id")
    .eq("id", p.consignor_id)
    .maybeSingle();

  if (!p.shopify_product_id || !p.shopify_variant_id) {
    return NextResponse.json(
      { error: "This listing has no Shopify product/variant reference - it can't be retried automatically." },
      { status: 400 }
    );
  }

  // 3. Reintentar actualizar la variante en Shopify
  try {
    await consignVariant({
      productId: p.shopify_product_id,
      variantId: p.shopify_variant_id,
      payout: p.desired_price,
      discordId: (consignorProfile as { discord_id: string | null } | null)?.discord_id ?? null,
      consignorId: p.consignor_id,
      internalProductId: p.id,
    });

    // 4. Marcar como publicado
    await admin
      .from("products")
      .update({ status: "published", admin_notes: null })
      .eq("id", p.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Shopify error" },
      { status: 500 }
    );
  }
}
