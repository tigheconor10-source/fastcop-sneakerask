import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { addBusinessHours } from "@/lib/businessHours";
import { sendDiscordDM, buildLabelReadyNotification } from "@/lib/discord";
import type { Profile } from "@/lib/types";

// Admin sube el PDF/imagen de la etiqueta de envío desde su ordenador.
// Se guarda en el bucket "shipping-labels" (Supabase Storage) y la URL
// pública resultante se guarda en sales.shipping_label_url.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (!(profile as Pick<Profile, "is_admin"> | null)?.is_admin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Nombre de archivo: <saleId>/<timestamp>-<nombre original>, evita colisiones
  // y mantiene la extensión original (pdf, png, jpg...).
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `${id}/${Date.now()}-${safeName}`;

  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await admin.storage
    .from("shipping-labels")
    .upload(path, arrayBuffer, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicUrlData } = admin.storage
    .from("shipping-labels")
    .getPublicUrl(path);

  // Subir la label es lo que ARRANCA el contador: a partir de ahora el
  // seller tiene 48h LABORABLES para enviarlo, o se aplica la multa de
  // LATE_SHIPPING_PENALTY al marcar la comisión como pagada. Si se
  // re-sube una label, se resetea cualquier extensión previa (plazo fresco).
  const shippingDeadline = addBusinessHours(new Date(), 48).toISOString();

  const { error: updateError, data: updatedSale } = await admin
    .from("sales")
    .update({
      shipping_label_url: publicUrlData.publicUrl,
      shipping_deadline: shippingDeadline,
      shipping_extension_hours: 0,
    })
    .eq("id", id)
    .select("consignor_id, products(brand, model, size), profiles(discord_id)")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Avisar al seller: ya tiene su label, el plazo de 48h laborables empieza ahora.
  const productsRaw = updatedSale?.products;
  const product = (Array.isArray(productsRaw) ? productsRaw[0] : productsRaw) as { brand: string; model: string; size: string } | null;
  const profilesRaw = updatedSale?.profiles;
  const sellerProfile = (Array.isArray(profilesRaw) ? profilesRaw[0] : profilesRaw) as Pick<Profile, "discord_id"> | null;
  if (sellerProfile?.discord_id && product) {
    try {
      await sendDiscordDM(
        sellerProfile.discord_id,
        buildLabelReadyNotification({
          brand: product.brand,
          model: product.model,
          size: product.size,
          labelUrl: publicUrlData.publicUrl,
          deadline: shippingDeadline,
        })
      );
    } catch (err) {
      console.error("Error enviando DM de label lista:", err);
    }
  }

  return NextResponse.json({ ok: true, url: publicUrlData.publicUrl });
}
