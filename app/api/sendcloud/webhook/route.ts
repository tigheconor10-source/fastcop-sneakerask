import { NextResponse } from "next/server";
import crypto from "crypto";

// Receptor de webhooks de Sendcloud (eventos "parcel_status_changed", etc).
//
// Sendcloud firma cada webhook con el header `Sendcloud-Signature`, un HMAC-
// SHA256 del body crudo usando el "Webhook secret" que Sendcloud genera para
// esta integración (lo verás en su panel DESPUÉS de guardar - pégalo en
// Vercel como SENDCLOUD_WEBHOOK_SECRET). Si esa env var no está puesta
// todavía, no verificamos firma (para poder probar la conexión ya) pero NO
// hacemos nada con los datos aún.
//
// TODO (cuando generemos labels vía Sendcloud con tu contrato UPS): aquí
// mapearemos parcel.id / tracking_number -> sales.id, y usaremos
// parcel.status (ej. "Announced", "En route", "Delivered") para marcar
// shipping_deadline / shipped automáticamente, sustituyendo la subida
// manual de label.
export async function POST(request: Request) {
  const rawBody = await request.text();

  const secret = process.env.SENDCLOUD_WEBHOOK_SECRET?.trim();
  if (secret) {
    const signature = (request.headers.get("sendcloud-signature") ?? "").trim();
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    const valid =
      sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);

    if (!valid) {
      // Logs de diagnóstico - NO exponen el secreto, solo su longitud, para
      // poder comparar con lo esperado (32 caracteres) y detectar espacios/
      // saltos de línea de más al pegarlo en Vercel.
      console.error("Sendcloud webhook: firma inválida", {
        secretLength: secret.length,
        receivedSignature: signature,
        expectedSignature: expected,
        bodyLength: rawBody.length,
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: any = null;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    // body no-JSON - igualmente respondemos 200 para que Sendcloud no
    // marque el webhook como roto mientras probamos la conexión.
  }

  console.log("Sendcloud webhook recibido:", JSON.stringify(payload));

  return NextResponse.json({ ok: true });
}
