import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchShopifyCatalog } from "@/lib/shopify";

// Búsqueda en vivo del catálogo: el consignador escribe un SKU o nombre, y
// devolvemos los productos que coinciden directamente desde fastcopstore.com
// (Shopify), junto con el precio actual de cada talla.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchShopifyCatalog(q);
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Shopify error" },
      { status: 500 }
    );
  }
}
