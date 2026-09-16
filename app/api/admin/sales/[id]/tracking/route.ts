import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

// body: { tracking_number: string } - el admin lo introduce a mano (UPS,
// etc.) mientras no haya generación automática de labels con tracking.
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
  const trackingNumber = typeof body?.tracking_number === "string" ? body.tracking_number.trim() : "";

  const admin = createAdminClient();
  const { error } = await admin
    .from("sales")
    .update({ tracking_number: trackingNumber || null })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
