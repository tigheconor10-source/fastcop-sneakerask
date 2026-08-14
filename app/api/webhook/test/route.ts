import { NextResponse } from "next/server";
import { sendDiscordAlert } from "../../../../lib/discord";

export const runtime = "nodejs";

/**
 * POST /api/webhook/test — manda una tarjeta de ejemplo a tu canal de
 * Discord, con datos inventados, para que veas el formato real sin tener
 * que esperar a que un anuncio de verdad se quede sin ser el mejor.
 */
export async function POST() {
  try {
    await sendDiscordAlert({
      title: "Producto de ejemplo — talla 42 EU",
      url: "https://sell.sneakerask.com/seller/listings?search=EJEMPLO-001",
      thumbnail: { url: "https://images.stockx.com/images/Adidas-Samba-OG-White-Black-Gum-Product.jpg" },
      description:
        "Esto es una PRUEBA — así se ve un aviso real cuando te bajan de precio y el bot reajusta solo.",
      color: 0x16a34a,
      fields: [
        { name: "Precio actual tuyo", value: "150€", inline: true },
        { name: "Mínimo del mercado (standard)", value: "148€", inline: true },
        { name: "Tu coste", value: "90€ con IVA (74.38€ sin IVA, es lo que cuenta)", inline: false },
        { name: "Beneficio mínimo que quieres", value: "20€", inline: true },
        { name: "Precio mínimo permitido", value: "94.38€", inline: true },
        { name: "SKU", value: "EJEMPLO-001", inline: true },
      ],
      footer: { text: "FastCop · sneakerask · esto es una prueba" },
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
