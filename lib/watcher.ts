import { TrackedListing, updateTrackedListing, minSellPrice } from "./db";
import { netCost } from "./vat";
import { getOwnListings, getSneakeraskProduct, updateListing } from "./sneakerask";
import { sendDiscordAlert } from "./discord";

export type CheckResult = {
  listingId: string;
  title: string;
  size: string;
  wasBest: boolean | null;
  isBest: boolean;
  lowestStandardAsk: number | null;
  action: "sin_cambios" | "sigue_siendo_mejor" | "repreciado_automatico" | "alerta_sin_repreciar" | "sin_anuncio_en_sneakerask";
  message: string;
};

/**
 * Comprueba UN anuncio trackeado: mira si sigue siendo "mejor anuncio",
 * y si le han bajado de precio, intenta reajustarse automáticamente por
 * debajo del rival — pero NUNCA por debajo de coste + beneficio mínimo.
 * Si bajar más te haría perder margen, no toca el precio y solo avisa.
 */
export async function checkAndRepriceOne(listing: TrackedListing): Promise<CheckResult> {
  if (!listing.sneakerask_listing_id) {
    return {
      listingId: listing.id,
      title: listing.title,
      size: listing.size,
      wasBest: listing.last_is_best,
      isBest: false,
      lowestStandardAsk: null,
      action: "sin_anuncio_en_sneakerask",
      message: "Este par todavía no tiene anuncio creado en sneakerask.",
    };
  }

  // 1) ¿Sigo siendo el mejor anuncio? (viene de "Own Listings")
  const { items: own } = await getOwnListings({ search: listing.sku });
  const mine = own.find((o) => o.id === listing.sneakerask_listing_id);
  const isBest = mine?.isBestListing ?? false;
  const currentPrice = mine?.price ?? listing.ask_price;

  // 2) ¿Cuál es el precio más bajo del mercado para esta talla ahora mismo?
  const product = await getSneakeraskProduct(listing.sneakerask_product_id);
  const sizeInfo = product?.sizes.find((s) => s.size === listing.size);
  const lowestStandardAsk = sizeInfo?.lowest_standard_ask ?? null;
  const lowestExpressAsk = sizeInfo?.lowest_express_ask ?? null;

  const wasBest = listing.last_is_best;

  // Sincroniza el estado (draft/active) por si lo cambiaste a mano en
  // sell.sneakerask.com — así tu panel aquí refleja lo real sin que
  // tengas que ir a mirar su web ni tocar nada tú.
  let statusChangedMsg = "";
  const remoteStatus = mine?.status === "draft" ? "draft" : mine?.status === "active" ? "active" : null;
  if (remoteStatus && remoteStatus !== listing.status) {
    await updateTrackedListing(listing.id, { status: remoteStatus });
    statusChangedMsg = ` (estado actualizado: ${listing.status} → ${remoteStatus}, cambiado en sneakerask)`;
    if (remoteStatus === "active" && listing.status === "draft") {
      await sendDiscordAlert(
        `🟢 **${listing.title}** (talla ${listing.size}) pasó de **Draft** a **Active** en sneakerask — ya está publicado y a la venta.`
      );
    }
  }

  await updateTrackedListing(listing.id, {
    lastIsBest: isBest,
    lastLowestStandardAsk: lowestStandardAsk,
    lastLowestExpressAsk: lowestExpressAsk,
    lastCheckedAt: new Date().toISOString(),
  });

  if (isBest) {
    return {
      listingId: listing.id,
      title: listing.title,
      size: listing.size,
      wasBest,
      isBest,
      lowestStandardAsk,
      action: "sigue_siendo_mejor",
      message: `Sigues siendo el mejor anuncio.${statusChangedMsg}`,
    };
  }

  // Te han bajado de precio (o nunca fuiste el mejor) — miramos si podemos reajustar.
  // Antes esto SIEMPRE comparaba contra el standard ask, aunque el anuncio
  // compitiera en express (que suele tener precios más altos) — ahora usa
  // el mercado que elegiste al crear el anuncio.
  const targetType = listing.target_ask_type ?? "standard";
  const marketLowest = targetType === "express" ? lowestExpressAsk : lowestStandardAsk;

  const floor = minSellPrice(listing.cost_price, listing.min_profit, listing.cost_includes_vat);
  const realCost = netCost(listing.cost_price, listing.cost_includes_vat);
  const targetPrice = marketLowest !== null ? marketLowest - 1 : null;

  const undercutMessage =
    `📉 **${listing.title}** (talla ${listing.size}, SKU ${listing.sku}) ya no es el mejor anuncio en sneakerask.\n` +
    `• Precio actual tuyo: **${currentPrice}€**\n` +
    `• Nuevo mínimo del mercado (${targetType}): **${marketLowest ?? "?"}€**\n` +
    `• Tu coste: ${listing.cost_price}€${listing.cost_includes_vat ? ` con IVA (${realCost.toFixed(2)}€ sin IVA, es lo que cuenta)` : " (ya sin IVA)"} · beneficio mínimo que quieres: ${listing.min_profit}€\n` +
    `• Precio mínimo al que puedes bajar sin perder margen: **${floor}€**\n` +
    `• Cambiarlo a mano: https://sell.sneakerask.com/seller/listings?search=${encodeURIComponent(listing.sku)}`;

  if (targetPrice !== null && targetPrice >= floor) {
    await updateListing(listing.sneakerask_listing_id, { price: targetPrice });
    await updateTrackedListing(listing.id, { askPrice: targetPrice });
    await sendDiscordAlert(
      `${undercutMessage}\n✅ Reajustado automáticamente a **${targetPrice}€** (sigue dejándote ${(targetPrice - realCost).toFixed(2)}€ de beneficio real).`
    );
    return {
      listingId: listing.id,
      title: listing.title,
      size: listing.size,
      wasBest,
      isBest,
      lowestStandardAsk,
      action: "repreciado_automatico",
      message: `Reajustado a ${targetPrice}€ (por debajo del rival en ${targetType}, sin bajar de tu mínimo de ${floor}€).${statusChangedMsg}`,
    };
  }

  await sendDiscordAlert(
    `${undercutMessage}\n⚠️ No se ha bajado el precio automáticamente — hacerlo te dejaría por debajo de tu beneficio mínimo. Decide tú si quieres bajarlo de todas formas.`
  );
  return {
    listingId: listing.id,
    title: listing.title,
    size: listing.size,
    wasBest,
    isBest,
    lowestStandardAsk,
    action: "alerta_sin_repreciar",
    message: `No se bajó el precio — el mercado en ${targetType} (${marketLowest ?? "?"}€) está por debajo de tu mínimo (${floor}€).${statusChangedMsg}`,
  };
}
