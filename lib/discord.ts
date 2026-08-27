import { getDiscordWebhookUrl } from "./db";

export async function sendDiscordAlert(message: string): Promise<void> {
  const webhookUrl = await getDiscordWebhookUrl();
  if (!webhookUrl) return; // sin webhook configurado, no hacemos nada

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    });
  } catch {
    // un fallo enviando el aviso no debe romper el resto del proceso
  }
}
