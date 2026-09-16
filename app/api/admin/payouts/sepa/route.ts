import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { buildSepaXml, type SepaPayment } from "@/lib/sepa";
import { isShipmentLate, LATE_SHIPPING_PENALTY } from "@/lib/lateFees";
import type { Profile } from "@/lib/types";

// Admin selecciona varias comisiones "pending" en /admin/payouts y genera un
// único XML SEPA para subir a su banco. Por cada una, si la venta está fuera
// de plazo de envío (sin marcar shipped), el importe del XML ya viene con la
// multa de LATE_SHIPPING_PENALTY € restada.
//
// IMPORTANTE: este endpoint NO marca nada como pagado ni toca la BD. Genera
// el XML y nada más - el admin sube ese XML al banco y, una vez confirmado
// que las transferencias han salido bien, marca cada una como pagada a mano
// (botón "Mark paid"), que es lo que realmente congela la multa. Así, si el
// XML falla o algo va mal, no queda nada marcado como pagado por error.
// Las que no tengan IBAN, o ya no estén 'pending', se omiten y se reportan.
export async function POST(request: Request) {
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

  const body = await request.json().catch(() => null);
  const commissionIds: string[] = Array.isArray(body?.commissionIds) ? body.commissionIds : [];
  if (commissionIds.length === 0) {
    return NextResponse.json({ error: "No commissions selected" }, { status: 400 });
  }

  if (!process.env.FASTCOP_IBAN) {
    return NextResponse.json(
      { error: "FASTCOP_IBAN is not configured (env var) - can't generate SEPA file" },
      { status: 500 }
    );
  }

  const admin = createAdminClient();

  const { data: commissions } = await admin
    .from("commissions")
    .select("*, sales(shopify_order_id, shipping_deadline, shipping_extension_hours, shipped_at), profiles(full_name, bank_account_holder, iban, bic_swift)")
    .in("id", commissionIds);

  const payments: SepaPayment[] = [];
  const skipped: { id: string; reason: string }[] = [];

  for (const c of commissions ?? []) {
    if (c.status !== "pending") {
      skipped.push({ id: c.id, reason: `Already ${c.status}` });
      continue;
    }

    const sellerProfile = c.profiles as Pick<Profile, "full_name" | "bank_account_holder" | "iban" | "bic_swift"> | null;
    const iban = sellerProfile?.iban?.trim();
    if (!iban) {
      skipped.push({ id: c.id, reason: "Seller has no IBAN on file" });
      continue;
    }

    const sale = c.sales as { shopify_order_id: string; shipping_deadline: string | null; shipping_extension_hours: number; shipped_at: string | null } | null;
    const late = sale ? isShipmentLate(sale) : false;
    const penalty = late ? LATE_SHIPPING_PENALTY : 0;
    const amount = Math.max(c.consignor_amount - penalty, 0);

    payments.push({
      endToEndId: `FASTCOP-${c.id.slice(0, 8)}`,
      amount,
      creditorName: sellerProfile?.bank_account_holder || sellerProfile?.full_name || "Fastcop seller",
      creditorIban: iban,
      creditorBic: sellerProfile?.bic_swift,
      remittanceInfo: `Fastcop payout - order ${sale?.shopify_order_id ?? ""}`.trim(),
    });
  }

  if (payments.length === 0) {
    return NextResponse.json({ error: "Nothing to pay", skipped }, { status: 400 });
  }

  const xml = buildSepaXml(payments);

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="fastcop-sepa-${new Date().toISOString().slice(0, 10)}.xml"`,
      "X-Skipped": encodeURIComponent(JSON.stringify(skipped)),
      "X-Count": String(payments.length),
    },
  });
}
