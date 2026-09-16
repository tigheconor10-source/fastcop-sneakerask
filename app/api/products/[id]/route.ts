import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { consignVariant } from "@/lib/shopify";
import { reconcileVariantAfterDelist } from "@/lib/reconcile";
import type { Product } from "@/lib/types";

// DELETE /api/products/[id] — el seller retira su listing permanentemente.
// Restaura el precio original en Shopify y borra la fila.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const { data: productRow } = await admin
    .from("products")
    .select("*")
    .eq("id", id)
    .eq("consignor_id", userData.user.id)
    .maybeSingle();

  const product = productRow as Product | null;
  if (!product) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

  if (!["published", "pending", "rejected", "removed"].includes(product.status)) {
    return NextResponse.json({ error: "This listing can't be removed" }, { status: 400 });
  }

  // Intentamos deslistar en Shopify si el listing llegó a tocar Shopify:
  // "published" (aprobado) o "pending" (consignVariant ya corrió al crearlo,
  // aunque el admin aún no lo haya aprobado — Shopify ya tiene el SKU vacío
  // y el precio de consignación puestos, así que hay que revertirlos igual).
  if (["published", "pending"].includes(product.status) && product.shopify_product_id && product.shopify_variant_id) {
    try {
      await reconcileVariantAfterDelist(product);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Shopify error" },
        { status: 500 }
      );
    }
  }

  const { error: deleteError } = await admin.from("products").delete().eq("id", id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// PATCH /api/products/[id] — togglear active/inactive.
// IMPORTANTE: leer el body PRIMERO (antes de cualquier otra await que
// pudiera consumir el stream), porque en Next.js 15 request.json() solo
// se puede llamar una vez y si algo más consume el stream antes el body
// llega vacío y action queda como undefined.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1) Leer body ANTES de cualquier otra operación async
  const body = await request.json().catch(() => null);
  const action = body?.action as "activate" | "deactivate" | undefined;

  if (!action || !["activate", "deactivate"].includes(action)) {
    return NextResponse.json({ error: "action must be 'activate' or 'deactivate'" }, { status: 400 });
  }

  const { id } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const { data: productRow } = await admin
    .from("products")
    .select("*")
    .eq("id", id)
    .eq("consignor_id", userData.user.id)
    .maybeSingle();

  const product = productRow as Product | null;
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ── DEACTIVATE: retirar de Shopify ──────────────────────────────
  if (action === "deactivate") {
    // Aceptar tanto published como pending — en ambos casos el listing
    // está en Shopify y hay que retirarlo
    if (!["published", "pending"].includes(product.status)) {
      return NextResponse.json(
        { error: `Can't deactivate a listing with status '${product.status}'` },
        { status: 400 }
      );
    }

    if (product.shopify_product_id && product.shopify_variant_id) {
      try {
        await reconcileVariantAfterDelist(product);
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "Shopify error" },
          { status: 500 }
        );
      }
    }

    await admin.from("products").update({ status: "removed" }).eq("id", id);
    return NextResponse.json({ ok: true, status: "removed" });
  }

  // ── ACTIVATE: volver a consignar en Shopify ─────────────────────
  if (action === "activate") {
    if (product.status !== "removed") {
      return NextResponse.json(
        { error: `Can't activate a listing with status '${product.status}'` },
        { status: 400 }
      );
    }

    if (!product.shopify_product_id || !product.shopify_variant_id) {
      return NextResponse.json(
        { error: "This listing has no Shopify variant linked — can't reactivate" },
        { status: 400 }
      );
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("discord_id")
      .eq("id", userData.user.id)
      .maybeSingle();

    try {
      await consignVariant({
        productId: product.shopify_product_id,
        variantId: product.shopify_variant_id,
        payout: product.desired_price,
        discordId: profile?.discord_id ?? "",
        consignorId: userData.user.id,
        internalProductId: product.id,
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Shopify error" },
        { status: 500 }
      );
    }

    // Vuelve a "pending" — el admin lo aprobará de nuevo igual que la
    // primera vez, así evitamos saltar directo a "published" sin revisión.
    await admin.from("products").update({ status: "pending" }).eq("id", id);
    return NextResponse.json({ ok: true, status: "pending" });
  }
}
