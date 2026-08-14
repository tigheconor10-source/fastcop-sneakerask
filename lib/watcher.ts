import { TrackedListing, updateTrackedListing, minSellPrice } from "./db";
import { netCost } from "./vat";
import { getOwnListingsBySearch, getSneakeraskProduct, updateListing } from "./sneakerask";
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

const round2 = (n: number) => Math.round(n * 100) / 100;

function editUrl(sku: string) {
  return `https://sell.sneakerask.com/seller/listings?search=${encodeURIComponent(sku)}`;
}

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
  const own = await getOwnListingsBySearch(listing.sku);
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
      await sendDiscordAlert({
        title: `${listing.title} — talla ${listing.size}`,
        url: editUrl(listing.sku),
        thumbnail: listing.image ? { url: listing.image } : undefined,
        description: "Pasó de **Draft** a **Active** en sneakerask — ya está publicado y a la venta.",
        color: 0x16a34a,
        fields: [{ name: "SKU", value: listing.sku, inline: true }],
        footer: { text: "FastCop · sneakerask" },
      });
    }
  }

  await updateTrackedListing(listing.id, {
    lastIsBest: isBest,
    lastLowestStandardAsk: lowestStandardAsk,
    lastLowestExpressAsk: lowestExpressAsk,
    lastCheckedAt: new Date().toISOString(),
  });

  if (isBest) {
    if (listing.last_alert_signature) {
      // Vuelves a ser el mejor — se resetea el silenciador, así si en el
      // futuro te bajan otra vez con los mismos números de ahora, sí te
      // avisa (no se queda callado para siempre por una coincidencia).
      await updateTrackedListing(listing.id, { lastAlertSignature: null });
    }
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
  // Usa el mercado (standard/express) que elegiste al crear el anuncio, no
  // siempre standard.
  const targetType = listing.target_ask_type ?? "standard";
  const marketLowest = targetType === "express" ? lowestExpressAsk : lowestStandardAsk;

  // Todo redondeado a 2 decimales desde aquí — antes el precio mínimo
  // salía con decimales interminables (ej. 119.14049586776859€) porque
  // netCost() divide entre 1.21 y eso da floats larguísimos sin redondear.
  const floor = round2(minSellPrice(listing.cost_price, listing.min_profit, listing.cost_includes_vat));
  const realCost = round2(netCost(listing.cost_price, listing.cost_includes_vat));
  const targetPrice = marketLowest !== null ? Math.floor(marketLowest - 1) : null;

  const baseFields = [
    { name: "Precio actual tuyo", value: `${currentPrice}€`, inline: true },
    { name: `Mínimo del mercado (${targetType}, el tuyo)`, value: `${marketLowest ?? "?"}€`, inline: true },
    {
      // Se muestra SIEMPRE el otro mercado también, aunque no compitas ahí
      // — así ves de un vistazo si te convendría más cambiar de standard
      // a express o viceversa, en vez de tener que ir a mirarlo tú.
      name: targetType === "standard" ? "Mínimo en Express (por si acaso)" : "Mínimo en Standard (por si acaso)",
      value: `${(targetType === "standard" ? lowestExpressAsk : lowestStandardAsk) ?? "?"}€`,
      inline: true,
    },
    {
      name: "Tu coste",
      value: listing.cost_includes_vat ? `${listing.cost_price}€ con IVA (${realCost}€ sin IVA, es lo que cuenta)` : `${listing.cost_price}€`,
      inline: false,
    },
    { name: "Beneficio mínimo que quieres", value: `${listing.min_profit}€`, inline: true },
    { name: "Precio mínimo permitido", value: `${floor}€`, inline: true },
  ];

  if (targetPrice !== null && targetPrice >= floor) {
    await updateListing(listing.sneakerask_listing_id, { price: targetPrice });
    await updateTrackedListing(listing.id, { askPrice: targetPrice });

    // Antes se asumía "ya eres el mejor" solo porque bajamos 1€ por debajo
    // del rival de TU mercado (standard o express) — pero eso no garantiza
    // nada si sneakerask compara todos los envíos juntos, o si el otro
    // mercado sigue estando más barato que tu nuevo precio. Así que se
    // vuelve a preguntar de verdad a sneakerask si ahora sí eres el mejor,
    // en vez de dar la palabra "reajustado" por sinónimo de "ganaste".
    const otherLowest = targetType === "standard" ? lowestExpressAsk : lowestStandardAsk;
    const beatenByOtherMarket = otherLowest !== null && otherLowest < targetPrice;

    const recheck = await getOwnListingsBySearch(listing.sku);
    const mineAfter = recheck.find((o) => o.id === listing.sneakerask_listing_id);
    const confirmedBest = mineAfter?.isBestListing ?? null;

    let outcomeLine: string;
    if (confirmedBest === true) {
      outcomeLine = `Ya no eras el mejor anuncio — **reajustado automáticamente a ${targetPrice}€ y confirmado: ya vuelves a ser el mejor** (te deja ${round2(targetPrice - realCost)}€ de beneficio real).`;
    } else if (beatenByOtherMarket) {
      outcomeLine =
        `Se bajó el precio a **${targetPrice}€** para ganar en ${targetType} (mínimo era ${marketLowest}€), ` +
        `pero **sigues sin ser el más barato en general**: en ${targetType === "standard" ? "Express" : "Standard"} hay un anuncio a ${otherLowest}€, ` +
        `más barato que tu nuevo precio. No se puede hacer nada más aquí sin bajar de tu mínimo (${floor}€).`;
    } else {
      outcomeLine = `Se bajó el precio a **${targetPrice}€** en ${targetType} (mínimo era ${marketLowest}€), pero sneakerask todavía no te marca como el mejor anuncio — puede tardar unos minutos en refrescar su ranking.`;
    }

    // No repetir el mismo aviso a Discord cada 30 min si la situación es
    // IDÉNTICA a la última vez (mismo precio, mismo mínimo del mercado,
    // mismo resultado) — solo avisa de nuevo si algo ha cambiado de verdad.
    const signature = `repriced:${targetPrice}:${marketLowest}:${otherLowest}:${confirmedBest}`;
    if (signature !== listing.last_alert_signature) {
      await sendDiscordAlert({
        title: `${listing.title} — talla ${listing.size}`,
        url: editUrl(listing.sku),
        thumbnail: listing.image ? { url: listing.image } : undefined,
        description: outcomeLine,
        color: confirmedBest === true ? 0x16a34a : 0xd97706,
        fields: [...baseFields, { name: "SKU", value: listing.sku, inline: true }],
        footer: { text: "FastCop · sneakerask" },
      });
    }
    await updateTrackedListing(listing.id, { lastAlertSignature: signature });

    return {
      listingId: listing.id,
      title: listing.title,
      size: listing.size,
      wasBest,
      isBest: confirmedBest ?? isBest,
      lowestStandardAsk,
      action: "repreciado_automatico",
      message: `${outcomeLine}${statusChangedMsg}`,
    };
  }

  {
    // Mismo throttle para el caso "no se puede hacer nada" — si sigue
    // exactamente igual que la última vez, no vuelve a avisar.
    const signature = `stuck:${currentPrice}:${marketLowest}:${floor}`;
    if (signature !== listing.last_alert_signature) {
      await sendDiscordAlert({
        title: `${listing.title} — talla ${listing.size}`,
        url: editUrl(listing.sku),
        thumbnail: listing.image ? { url: listing.image } : undefined,
        description: "Ya no eres el mejor anuncio y **no se ha bajado el precio** — hacerlo te dejaría por debajo de tu beneficio mínimo. Decide tú si quieres bajarlo a mano.",
        color: 0xd97706,
        fields: [...baseFields, { name: "SKU", value: listing.sku, inline: true }],
        footer: { text: "FastCop · sneakerask" },
      });
    }
    await updateTrackedListing(listing.id, { lastAlertSignature: signature });
  }

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
