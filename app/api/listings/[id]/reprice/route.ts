import { NextResponse } from "next/server";
import { getTrackedListing } from "../../../../../lib/db";
import { checkAndRepriceOne } from "../../../../../lib/watcher";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const listing = await getTrackedListing(params.id);
    if (!listing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    const result = await checkAndRepriceOne(listing);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
