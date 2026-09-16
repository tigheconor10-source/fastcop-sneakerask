// Funciones para enviar mensajes directos (DM) a través del bot de Discord.
// Documentación: https://discord.com/developers/docs/resources/user#create-dm

import { LATE_SHIPPING_PENALTY } from "./lateFees";
const DISCORD_API = "https://discord.com/api/v10";

function discordHeaders() {
  return {
    Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
    "Content-Type": "application/json",
  };
}

// Envía un mensaje directo a un usuario de Discord a partir de su discord_id.
// El bot debe estar en un servidor compartido con ese usuario (nuestro
// servidor de Fastcop) para poder abrirle un canal de DM.
export async function sendDiscordDM(discordUserId: string, content: string) {
  // 1. Abrir (o reutilizar) el canal de DM con ese usuario
  const channelRes = await fetch(`${DISCORD_API}/users/@me/channels`, {
    method: "POST",
    headers: discordHeaders(),
    body: JSON.stringify({ recipient_id: discordUserId }),
  });

  if (!channelRes.ok) {
    throw new Error(
      `Discord channel error: ${channelRes.status} ${await channelRes.text()}`
    );
  }

  const channel = await channelRes.json();

  // 2. Enviar el mensaje a ese canal
  const messageRes = await fetch(
    `${DISCORD_API}/channels/${channel.id}/messages`,
    {
      method: "POST",
      headers: discordHeaders(),
      body: JSON.stringify({ content }),
    }
  );

  if (!messageRes.ok) {
    throw new Error(
      `Discord message error: ${messageRes.status} ${await messageRes.text()}`
    );
  }
}

// Envía un mensaje a un canal de Discord a través de un webhook de canal
// (Settings > Integrations > Webhooks). A diferencia de sendDiscordDM, esto
// NO requiere el bot ni abrir un DM - es un simple POST a la URL del webhook.
// Se usa para avisar al admin (Fastcop) cada vez que se detecta una venta.
export async function sendDiscordWebhookMessage(webhookUrl: string, content: string) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  if (!res.ok) {
    throw new Error(`Discord webhook error: ${res.status} ${await res.text()}`);
  }
}

// Construye el aviso de venta para el canal del admin.
export function buildAdminSaleAlert(params: {
  brand: string;
  model: string;
  size: string;
  shopifyOrderId: string;
  salePrice: number;
  consignorAmount: number;
  sellerName: string;
  dmError?: string | null;
}) {
  const lines = [
    `🛒 **New sale!** ${params.brand} ${params.model} (EU ${params.size})`,
    ``,
    `Seller: ${params.sellerName}`,
    `Order #${params.shopifyOrderId} · Sale price €${params.salePrice.toFixed(2)} · Payout €${params.consignorAmount.toFixed(2)}`,
  ];

  if (params.dmError) {
    lines.push(``, `⚠️ Couldn't DM the seller: ${params.dmError}`);
  }

  return lines.join("\n");
}
export function buildSaleNotification(params: {
  brand: string;
  model: string;
  size: string;
  shopifyOrderId: string;
  consignorAmount: number;
  shippingAddress: string;
  shippingCity: string;
  shippingZip: string;
  shippingCountry: string;
}) {
  return [
    `📦 **Your ${params.brand} ${params.model} (EU ${params.size}) just sold!**`,
    ``,
    `Order #${params.shopifyOrderId}`,
    `You'll receive **€${params.consignorAmount.toFixed(2)}** for this sale.`,
    ``,
    `We're preparing your shipping label - we'll send it to you here as`,
    `soon as it's ready. Once you have it, you'll have **48 business hours**`,
    `(weekends don't count) to drop off the package.`,
    ``,
    `It's headed to:`,
    params.shippingAddress,
    `${params.shippingZip} ${params.shippingCity}, ${params.shippingCountry}`,
  ].join("\n");
}

// DM al consignador cuando el admin sube su label de envío. A partir de
// este momento empieza el plazo de 48h laborables.
export function buildLabelReadyNotification(params: {
  brand: string;
  model: string;
  size: string;
  labelUrl: string;
  deadline: string; // ISO
}) {
  const deadlineDate = new Date(params.deadline);
  const formatted = deadlineDate.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return [
    `🏷️ **Your shipping label for ${params.brand} ${params.model} (EU ${params.size}) is ready!**`,
    ``,
    `Download it here: ${params.labelUrl}`,
    ``,
    `**Drop off the package within 48 business hours** (weekends don't`,
    `count) - by **${formatted}**.`,
    ``,
    `⚠️ If it's not dropped off by then, a €${LATE_SHIPPING_PENALTY} late fee is deducted from your payout.`,
  ].join("\n");
}

