import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

// Admin corrige el precio de venta registrado para un pedido. Al guardar,
// recalculamos la comisión vinculada: el consignador sigue recibiendo su
// payout fijo (consignor_amount no cambia), pero la parte de Fastcop
// (fastcop_fee = sale_price - consignor_amount) se ajusta al nuevo precio.
export async function PATCH(
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

  const body = await request.json().catch(() => null);
  const salePrice = Number(body?.salePrice);

  if (!salePrice || Number.isNaN(salePrice) || salePrice < 0) {
    return NextResponse.json({ error: "Invalid sale price" }, { status: 400 });
  }

  const admin = createAdminClient();

  // 1. Actualizar el precio de venta de la fila "sales"
  const { error: saleError } = await admin
    .from("sales")
    .update({ sale_price: salePrice })
    .eq("id", id);

  if (saleError) {
    return NextResponse.json({ error: saleError.message }, { status: 500 });
  }

  // 2. Recalcular la comisión vinculada (consignor_amount se mantiene fijo;
  // ajustamos fastcop_fee y commission_rate al nuevo sale_price)
  const { data: commission } = await admin
    .from("commissions")
    .select("*")
    .eq("sale_id", id)
    .maybeSingle();

  if (commission) {
    const consignorAmount = commission.consignor_amount;
    const fastcopFee = Math.max(salePrice - consignorAmount, 0);
    const effectiveRate =
      salePrice > 0 ? Math.round((fastcopFee / salePrice) * 10000) / 100 : 0;

    const { error: commissionError } = await admin
      .from("commissions")
      .update({
        sale_price: salePrice,
        fastcop_fee: fastcopFee,
        commission_rate: effectiveRate,
      })
      .eq("id", commission.id);

    if (commissionError) {
      return NextResponse.json({ error: commissionError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

// Admin borra un registro de venta por completo (ya gestionado/pagado).
// La tabla "commissions" tiene "on delete cascade" sobre sale_id, así que
// su comisión asociada se borra automáticamente.
export async function DELETE(
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
  const { error } = await admin.from("sales").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
