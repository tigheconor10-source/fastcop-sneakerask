// Envío de emails transaccionales vía Resend (https://resend.com).
// Usa fetch directo a su API REST - no requiere instalar su SDK.
//
// Requiere las variables de entorno:
//   RESEND_API_KEY    - API key de Resend
//   RESEND_FROM_EMAIL - remitente verificado, ej. "Fastcop <notifications@fastcopstore.com>"
//
// Si RESEND_API_KEY no está configurada, sendEmail no hace nada (no rompe
// el flujo) - así el resto de la app sigue funcionando aunque el email no
// esté montado todavía.
export async function sendEmail(params: { to: string; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    console.log("RESEND_API_KEY/RESEND_FROM_EMAIL no configuradas - email no enviado:", params.subject);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend error: ${res.status} ${await res.text()}`);
  }
}

// Email al consignador cuando su par se vende - le avisa y le dice que
// revise su página de Orders para descargar la etiqueta de envío cuando
// esté lista.
export function buildSaleEmail(params: {
  brand: string;
  model: string;
  size: string;
  shopifyOrderId: string;
  consignorAmount: number;
}) {
  const ordersUrl = "https://fastcop-consignment.vercel.app/dashboard/orders";

  return {
    subject: `Your ${params.brand} ${params.model} just sold! 🎉`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #0f172a;">
        <h2 style="margin-bottom: 4px;">Your pair just sold!</h2>
        <p style="color: #6b7488; margin-top: 0;">${params.brand} ${params.model} (EU ${params.size}) · Order #${params.shopifyOrderId}</p>
        <p>You'll receive <strong>€${params.consignorAmount.toFixed(2)}</strong> for this sale.</p>
        <p>We're preparing your shipping label. Once it's ready, head to your
        <a href="${ordersUrl}" style="color: #2563eb;">Orders page</a> to download it -
        you'll have 48 business hours (weekends don't count) to drop off the
        package once you have it, or a €15 late fee applies.</p>
        <p style="margin-top: 24px;">
          <a href="${ordersUrl}" style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: 600;">
            Go to Orders
          </a>
        </p>
        <p style="color: #6b7488; font-size: 12px; margin-top: 32px;">Fastcop Consignment</p>
      </div>
    `,
  };
}
