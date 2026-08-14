import { NextRequest, NextResponse } from "next/server";
import { createTrackedListing } from "../../../../lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

type ImportItem = {
  sneakeraskListingId: number;
  sneakeraskProductId: number;
  sku: string;
  title: string;
  image: string | null;
  brand: string | null;
  size: string;
  askPrice: number;
  quantity: number;
  costPrice: number;
  costIncludesVat?: boolean;
  minProfit: number;
  targetAskType?: "standard" | "express";
};

/**
 * POST /api/listings/import — mete en la vigilancia anuncios que YA
 * existen en sneakerask (creados desde su dashboard, no desde esta app).
 * A diferencia de crear un anuncio nuevo, aquí NO se llama a la API de
 * sneakerask para nada — el anuncio ya existe, solo se empieza a
 * seguir localmente con tu coste y beneficio mínimo.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items: ImportItem[] = body.items;
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Falta la lista de anuncios a importar" }, { status: 400 });
    }

    const saved = [];
    for (const item of items) {
      if (!item.costPrice && item.costPrice !== 0) continue; // sin coste no se puede vigilar bien
      const created = await createTrackedListing({
        sneakeraskProductId: item.sneakeraskProductId,
        sneakeraskListingId: item.sneakeraskListingId,
        sku: item.sku,
        title: item.title,
        image: item.image,
        brand: item.brand,
        size: item.size,
        costPrice: item.costPrice,
        costIncludesVat: item.costIncludesVat !== false,
        minProfit: item.minProfit ?? 20,
        askPrice: item.askPrice,
        quantity: item.quantity ?? 1,
        targetAskType: item.targetAskType ?? "standard",
      });
      saved.push(created);
    }

    return NextResponse.json({ ok: true, imported: saved.length, saved });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
