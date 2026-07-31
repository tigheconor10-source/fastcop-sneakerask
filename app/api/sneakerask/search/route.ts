import { NextRequest, NextResponse } from "next/server";
import { searchSneakeraskProducts } from "../../../../lib/sneakerask";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ items: [] });

  // Diagnóstico temporal: llamamos también en crudo, sin pasar por el
  // parseo normal, para ver EXACTAMENTE qué responde sneakerask.
  const auth = process.env.SNEAKERASK_AUTH_KEY;
  const appKey = process.env.SNEAKERASK_APP_KEY;
  let raw: any = null;
  try {
    const rawRes = await fetch(
      `https://api.sneakerask.com/api/seller-v1/seller-variant-listings/products?per_page=20&page=1&search=${encodeURIComponent(q)}`,
      {
        headers: {
          Authorization: `Bearer ${auth}`,
          "X-App-Key": appKey || "",
          Accept: "application/json",
        },
      }
    );
    const text = await rawRes.text();
    raw = { httpStatus: rawRes.status, body: text.slice(0, 2000) };
  } catch (e: any) {
    raw = { fetchError: e.message };
  }

  try {
    const result = await searchSneakeraskProducts(q);
    return NextResponse.json({ ...result, _debug: raw });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, _debug: raw }, { status: 500 });
  }
}
