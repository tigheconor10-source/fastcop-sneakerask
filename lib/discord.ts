import { getDiscordWebhookUrl } from "./db";

export type DiscordEmbed = {
  title: string;
  url?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  thumbnail?: { url: string };
  footer?: { text: string };
};

/** Acepta texto plano (compatibilidad) o una tarjeta (embed) — usa embed
 *  siempre que puedas, se lee mucho más claro que un bloque de texto. */
export async function sendDiscordAlert(payload: string | DiscordEmbed): Promise<void> {
  const webhookUrl = await getDiscordWebhookUrl();
  if (!webhookUrl) return;

  const body = typeof payload === "string" ? { content: payload } : { embeds: [payload] };

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // un fallo enviando el aviso no debe romper el resto del proceso
  }
}
