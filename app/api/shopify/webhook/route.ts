import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { sendDiscordDM, buildSaleNotification, sendDiscordWebhookMessage, buildAdminSaleAlert } from "@/lib/discord";
import { sendEmail, buildSaleEmail } from "@/lib/email";
import { extractNumericId } from "@/lib/shopify";
import { reconcileVariantAfterDelist } from "@/lib/reconcile";
import type { Product, Profile } from "@/lib/types";

// Shopify llama a esta URL cada vez que se crea un pedido (orders/create).
// El webhook YA ESTÁ REGISTRADO en Shopify Admin > Settings > Notifications >
// Webhooks ("Creación de pedido" -> .../api/shopify/webhook, JSON).
// SHOPIFY_WEBHOOK_SECRET debe ser el "signing secret" que aparece en esa
// misma página (es un secreto compartido por toda la tienda).

function verifyShopifyWebhook(rawBody: string, hmacHeader: string | null) {
  if (!hmacHeader) return false;

  const digest = crypto
    .createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET!)
    .update(rawBody, "utf8")
    .digest("base64");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(digest),
      Buffer.from(hmacHeader)
    );
  } catch {
    // Si las longitudes no coinciden, timingSafeEqual lanza - tratamos como inválido.
    return false;
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const hmacHeader = request.headers.get("x-shopify-hmac-sha256");

  if (!verifyShopifyWebhook(rawBody, hmacHeader)) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  const order = JSON.parse(rawBody);
  const supabase = createAdminClient();

  const shippingAddress = order.shipping_address ?? {};
  const customerName = order.customer
    ? `${order.customer.first_name ?? ""} ${order.customer.last_name ?? ""}`.trim()
    : null;

  // Traemos TODOS los productos publicados que tengan shopify_variant_id.
  // No podemos hacer un .eq() directo porque shopify_variant_id puede estar
  // guardado como GID ("gid://shopify/ProductVariant/123") o como número
  // plano ("123") según cuándo se creó el listado, mientras que
  // line_items[].variant_id del webhook SIEMPRE es numérico. Normalizamos
  // ambos lados con extractNumericId() antes de comparar.
  const { data: candidates } = await supabase
    .from("products")
    .select("*")
    .eq("status", "published")
    .not("shopify_variant_id", "is", null);

  const published = (candidates ?? []) as Product[];

  for (const lineItem of order.line_items ?? []) {
    const lineItemVariantId = String(lineItem.variant_id ?? "");
    if (!lineItemVariantId) continue;

    const product = published.find(
      (p) =>
        p.shopify_variant_id &&
        extractNumericId(p.shopify_variant_id) === lineItemVariantId
    );

    if (!product) continue; // No es un producto de consignment, lo ignoramos

    const p = product;
    const salePrice = Number(lineItem.price) * Number(lineItem.quantity ?? 1);

    // 1. Registrar la venta (idempotente: índice único en
    // (shopify_order_id, product_id) evita duplicados si Shopify reintenta
    // el webhook).
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .insert({
        product_id: p.id,
        consignor_id: p.consignor_id,
        shopify_order_id: String(order.order_number ?? order.id),
        sale_price: salePrice,
        customer_name: customerName,
        shipping_address: [shippingAddress.address1, shippingAddress.address2]
          .filter(Boolean)
          .join(", "),
        shipping_city: shippingAddress.city ?? null,
        shipping_zip: shippingAddress.zip ?? null,
        shipping_country: shippingAddress.country ?? null,
        shipping_status: "unshipped",
      })
      .select()
      .single();

    if (saleError) {
      // Si es un duplicado (reintento de Shopify), no es un error real -
      // ya procesamos esta venta antes. Saltamos al siguiente line item.
      if (saleError.code === "23505") continue;
      console.error("Error inserting sale:", saleError);
      continue;
    }
    if (!sale) continue;

    // 2. Marcar el producto como vendido
    await supabase.from("products").update({ status: "sold" }).eq("id", p.id);

    // 3. Deslistar la variante en Shopify: el "ask" tiene que desaparecer
    // por completo - precio restaurado, SKU restaurado (para que el bot de
    // precios vuelva a gestionarla) y TODOS los metacampos de consignación
    // limpiados.
    if (p.shopify_product_id && p.shopify_variant_id) {
      try {
        await reconcileVariantAfterDelist(p, salePrice);
      } catch (err) {
        console.error("Error delisting sold variant:", err);
      }
    }

    // 4. Calcular y registrar la comisión.
    // El consignador recibe su "payout price" fijo (p.desired_price).
    // Fastcop se queda con la diferencia respecto al precio de venta real.
    const consignorAmount = p.desired_price;
    const fastcopFee = Math.max(salePrice - consignorAmount, 0);
    const effectiveRate =
      salePrice > 0 ? Math.round((fastcopFee / salePrice) * 10000) / 100 : 0;

    await supabase.from("commissions").insert({
      sale_id: sale.id,
      consignor_id: p.consignor_id,
      sale_price: salePrice,
      commission_rate: effectiveRate,
      fastcop_fee: fastcopFee,
      consignor_amount: consignorAmount,
      status: "pending",
    });

    // 5. Avisar al consignador y al admin por Discord
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", p.consignor_id)
      .maybeSingle();

    const consignorProfile = profileRow as Profile | null;

    // 5. Avisar al consignador por DM de Discord (siempre, si tiene cuenta
    // de Discord enlazada - es información que necesita para enviar el par).
    let dmError: string | null = null;
    if (consignorProfile?.discord_id) {
      try {
        await sendDiscordDM(
          consignorProfile.discord_id,
          buildSaleNotification({
            brand: p.brand,
            model: p.model,
            size: p.size,
            shopifyOrderId: String(order.order_number ?? order.id),
            consignorAmount,
            shippingAddress: sale.shipping_address ?? "",
            shippingCity: sale.shipping_city ?? "",
            shippingZip: sale.shipping_zip ?? "",
            shippingCountry: sale.shipping_country ?? "",
          })
        );
      } catch (err) {
        // No bloqueamos el webhook si falla el DM; solo lo registramos y lo
        // incluimos en el aviso del canal de admin para que se note.
        dmError = err instanceof Error ? err.message : "Unknown error";
        console.error("Error enviando DM de Discord:", err);
      }
    } else {
      dmError = "Seller has no discord_id linked";
    }

    // 5b. Email al consignador (además del DM) - mismo aviso, dirigiéndole
    // a /dashboard/orders para descargar la label cuando esté lista.
    if (consignorProfile?.email) {
      try {
        await sendEmail({
          to: consignorProfile.email,
          ...buildSaleEmail({
            brand: p.brand,
            model: p.model,
            size: p.size,
            shopifyOrderId: String(order.order_number ?? order.id),
            consignorAmount,
          }),
        });
      } catch (err) {
        console.error("Error enviando email de venta:", err);
      }
    }

    // 6. Avisar al admin en un canal de Discord (vía webhook de canal) para
    // que pueda hacer seguimiento manual si hace falta.
    if (process.env.DISCORD_SALE_ALERT_WEBHOOK) {
      try {
        await sendDiscordWebhookMessage(
          process.env.DISCORD_SALE_ALERT_WEBHOOK,
          buildAdminSaleAlert({
            brand: p.brand,
            model: p.model,
            size: p.size,
            shopifyOrderId: String(order.order_number ?? order.id),
            salePrice,
            consignorAmount,
            sellerName: consignorProfile?.discord_username ?? consignorProfile?.full_name ?? "Unknown",
            dmError,
          })
        );
      } catch (err) {
        console.error("Error enviando aviso al canal de admin:", err);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
