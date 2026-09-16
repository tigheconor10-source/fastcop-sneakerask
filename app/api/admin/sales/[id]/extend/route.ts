import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

// Admin concede más tiempo de envío a un seller para esta venta concreta
// (ej. está fuera por viaje, pidió un día más...). Las horas se SUMAN a
// shipping_extension_hours - se añaden directas (sin lógica laborable), es
// un margen de gracia puntual.
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
  const extraHours = Number(body?.extraHours);
  if (!extraHours || !Number.isFinite(extraHours) || extraHours <= 0) {
    return NextResponse.json({ error: "Invalid hours" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: sale } = await admin
    .from("sales")
    .select("shipping_extension_hours")
    .eq("id", id)
    .maybeSingle();

  if (!sale) {
    return NextResponse.json({ error: "Sale not found" }, { status: 404 });
  }

  const { error } = await admin
    .from("sales")
    .update({ shipping_extension_hours: (sale.shipping_extension_hours ?? 0) + extraHours })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
