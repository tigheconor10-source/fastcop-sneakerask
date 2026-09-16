import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Para cada shopify_variant_id pasado, devuelve el menor "payout" entre
// TODOS los listados publicados de esa talla (de cualquier consignador).
// Se usa en "Add product" para sugerir un precio que te haga el "Best ask".
// La RLS de "products" solo deja ver tus propias filas, así que usamos el
// cliente admin (solo lectura aquí).
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const variantIds = searchParams.get("variantIds")?.split(",").filter(Boolean) ?? [];

  if (variantIds.length === 0) {
    return NextResponse.json({ minPayout: {} });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("products")
    .select("shopify_variant_id, desired_price")
    .eq("status", "published")
    .in("shopify_variant_id", variantIds);

  const minPayout: Record<string, number> = {};
  for (const row of data ?? []) {
    const key = row.shopify_variant_id as string;
    if (minPayout[key] === undefined || row.desired_price < minPayout[key]) {
      minPayout[key] = row.desired_price;
    }
  }

  return NextResponse.json({ minPayout });
}
