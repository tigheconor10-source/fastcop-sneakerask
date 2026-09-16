import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isShipmentLate, LATE_SHIPPING_PENALTY } from "@/lib/lateFees";
import type { Profile } from "@/lib/types";

// Marca UNA comisión como pagada (botón "Mark paid" individual). Si la
// venta asociada está fuera de plazo de envío (y sin label subida todavía),
// se aplica y "congela" la multa de LATE_SHIPPING_PENALTY € en
// commissions.late_penalty - igual que hace el generador SEPA en bloque.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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

  const admin = createAdminClient();

  const { data: commission } = await admin
    .from("commissions")
    .select("*, sales(shipping_deadline, shipping_extension_hours, shipped_at)")
    .eq("id", id)
    .maybeSingle();

  if (!commission) {
    return NextResponse.json({ error: "Commission not found" }, { status: 404 });
  }

  const sale = commission.sales as { shipping_deadline: string | null; shipping_extension_hours: number; shipped_at: string | null } | null;
  const late = sale ? isShipmentLate(sale) : false;
  const penalty = late ? LATE_SHIPPING_PENALTY : 0;

  const { error } = await admin
    .from("commissions")
    .update({ status: "paid", late_penalty: penalty })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, latePenalty: penalty });
}
