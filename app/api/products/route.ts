import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { consignVariant } from "@/lib/shopify";

// POST /api/products — crea un anuncio de consignación para UNA talla.
// El formulario de /dashboard/new llama a este endpoint una vez por
// cada talla seleccionada. Devuelve { results: [{ size, ok, error? }] }
// para que el front pueda mostrar errores por talla sin cancelar el resto.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Perfil del consignador: necesitamos discord_id para el metafield de
  // Shopify y verificar que la cuenta está aprobada.
  const { data: profile } = await admin
    .from("profiles")
    .select("discord_id, is_approved, vacation_mode")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (!profile?.is_approved) {
    return NextResponse.json({ error: "Account not approved" }, { status: 403 });
  }
  if (profile.vacation_mode) {
    return NextResponse.json(
      { error: "Vacation mode is active — disable it before adding new listings" },
      { status: 409 }
    );
  }

  const body = await req.json();
  const {
    sku,
    brand,
    model,
    imageUrl,
    productId,
    variants,   // { [size]: { variantId, price, sku: variantSku } }
    sizes,
    payoutPrice,
    vatType,
  } = body;

  if (!sizes?.length || !payoutPrice || !productId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const results: { size: string; ok: boolean; error?: string }[] = [];

  for (const size of sizes as string[]) {
    const variantInfo = variants?.[size];
    if (!variantInfo?.variantId) {
      results.push({ size, ok: false, error: "No variant found for this size" });
      continue;
    }

    // Crear la fila en la BD ANTES de tocar Shopify, así si Shopify falla
    // el admin puede ver que algo fue a medias y corregirlo sin datos huérfanos.
    let internalId: string | null = null;
    try {
      const { data: inserted, error: insertError } = await admin
        .from("products")
        .insert({
          consignor_id: userData.user.id,
          brand,
          model,
          size,
          desired_price: payoutPrice,
          photos: imageUrl ? [imageUrl] : [],
          status: "pending",
          shopify_product_id: productId,
          shopify_variant_id: variantInfo.variantId,
          original_price: variantInfo.price ?? null,
          original_sku: variantInfo.sku ?? sku ?? null,
          vat_type: vatType ?? "margin_scheme",
          commission_rate: 15,
        })
        .select("id")
        .single();

      if (insertError || !inserted) {
        results.push({ size, ok: false, error: insertError?.message ?? "DB insert failed" });
        continue;
      }
      internalId = inserted.id;
    } catch (err) {
      results.push({ size, ok: false, error: String(err) });
      continue;
    }

    // Actualizar Shopify: precio de venta, metafields de consignación.
    try {
      await consignVariant({
        productId,
        variantId: variantInfo.variantId,
        payout: payoutPrice,
        discordId: profile.discord_id ?? "",
        consignorId: userData.user.id,
        internalProductId: internalId!,
      });

      // Shopify OK → marcamos como pendiente de aprobación del admin.
      // (El webhook de Shopify puede cambiar esto automáticamente si está configurado.)
      results.push({ size, ok: true });
    } catch (err) {
      // Shopify falló: marcamos el registro como rechazado con la nota del error
      // para que el admin lo vea en su panel.
      await admin
        .from("products")
        .update({
          status: "rejected",
          admin_notes: `Shopify error: ${err instanceof Error ? err.message : String(err)}`,
        })
        .eq("id", internalId!);

      results.push({
        size,
        ok: false,
        error: err instanceof Error ? err.message : "Shopify error",
      });
    }
  }

  return NextResponse.json({ results });
}
