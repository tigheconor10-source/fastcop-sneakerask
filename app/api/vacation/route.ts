import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { consignVariant } from "@/lib/shopify";
import { reconcileVariantAfterDelist } from "@/lib/reconcile";
import type { Product, Profile } from "@/lib/types";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const enable = body?.enable as boolean;

  // createAdminClient (service_role) en vez del cliente de sesión: evita que
  // políticas RLS mal configuradas en "profiles" bloqueen la lectura del
  // propio perfil del usuario ya autenticado. La verificación de identidad
  // ya se hizo arriba con supabase.auth.getUser().
  const admin = createAdminClient();

  const { data: profileRow } = await admin
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .maybeSingle();

  const profile = profileRow as Profile | null;
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  if (enable) {
    // ── ACTIVAR ──────────────────────────────────────────────
    // Deslistar todos los productos publicados y guardar sus IDs
    const { data: products } = await admin
      .from("products")
      .select("*")
      .eq("consignor_id", userData.user.id)
      .eq("status", "published");

    const publishedProducts = (products ?? []) as Product[];
    const pausedIds: string[] = [];

    for (const p of publishedProducts) {
      if (p.shopify_product_id && p.shopify_variant_id) {
        try {
          await reconcileVariantAfterDelist(p);
          pausedIds.push(p.id);
          await admin
            .from("products")
            .update({ status: "removed" })
            .eq("id", p.id);
        } catch {
          // si falla uno seguimos con el resto
        }
      }
    }

    await admin
      .from("profiles")
      .update({ vacation_mode: true, vacation_paused_ids: pausedIds })
      .eq("id", userData.user.id);

    return NextResponse.json({ ok: true, paused: pausedIds.length });
  } else {
    // ── DESACTIVAR ───────────────────────────────────────────
    // Reactivar todos los productos pausados
    const pausedIds = profile.vacation_paused_ids ?? [];

    if (pausedIds.length === 0) {
      await admin
        .from("profiles")
        .update({ vacation_mode: false })
        .eq("id", userData.user.id);
      return NextResponse.json({ ok: true, resumed: 0 });
    }

    const { data: products } = await admin
      .from("products")
      .select("*")
      .in("id", pausedIds);

    const pausedProducts = (products ?? []) as Product[];
    let resumed = 0;

    for (const p of pausedProducts) {
      if (p.shopify_product_id && p.shopify_variant_id) {
        try {
          await consignVariant({
            productId: p.shopify_product_id,
            variantId: p.shopify_variant_id,
            payout: p.desired_price,
            discordId: profile.discord_id,
            consignorId: userData.user.id,
            internalProductId: p.id,
          });
          await admin
            .from("products")
            .update({ status: "published" })
            .eq("id", p.id);
          resumed++;
        } catch {
          // si falla uno seguimos con el resto
        }
      }
    }

    await admin
      .from("profiles")
      .update({ vacation_mode: false, vacation_paused_ids: [] })
      .eq("id", userData.user.id);

    return NextResponse.json({ ok: true, resumed });
  }
}
