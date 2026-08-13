import { NextRequest, NextResponse } from "next/server";
import { searchSneakeraskProducts } from "../../../../lib/sneakerask";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const by = (req.nextUrl.searchParams.get("by") as "auto" | "sku" | "title" | "brand") ?? "auto";
  if (!q) return NextResponse.json({ items: [] });

  try {
    const result = await searchSneakeraskProducts(q, 1, by);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
