import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Product, Commission, Profile } from "@/lib/types";
import { calculateSellingPrice } from "@/lib/pricing";
import DashboardClient from "@/components/DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const admin = createAdminClient();

  const [{ data: products }, { data: commissions }, { data: sales }, { data: profile }] =
    await Promise.all([
      admin
        .from("products")
        .select("*")
        .eq("consignor_id", userData.user!.id)
        .order("created_at", { ascending: false }),
      admin
        .from("commissions")
        .select("*")
        .eq("consignor_id", userData.user!.id)
        .order("created_at", { ascending: false }),
      admin
        .from("sales")
        .select("id, created_at, sale_price, shopify_order_id, shipping_label_url, products(brand, model, size, photos, vat_type)")
        .eq("consignor_id", userData.user!.id)
        .order("created_at", { ascending: false }),
      admin
        .from("profiles")
        .select("discord_username, vacation_mode")
        .eq("id", userData.user!.id)
        .maybeSingle(),
    ]);

  const p = profile as Pick<Profile, "discord_username" | "vacation_mode"> | null;
  const myProducts = (products ?? []) as Product[];

  const publishedVariantIds = Array.from(
    new Set(
      myProducts
        .filter((pr) => ["published", "pending"].includes(pr.status) && pr.shopify_variant_id)
        .map((pr) => pr.shopify_variant_id as string)
    )
  );

  const bestCompetitorPrice: Record<string, number> = {};

  if (publishedVariantIds.length > 0) {
    const { data: competing } = await admin
      .from("products")
      .select("shopify_variant_id, desired_price, consignor_id")
      .in("status", ["published", "pending"])
      .in("shopify_variant_id", publishedVariantIds);

    for (const row of competing ?? []) {
      if (row.consignor_id === userData.user!.id) continue;
      const sp = calculateSellingPrice(row.desired_price);
      if (sp === null) continue;
      const key = row.shopify_variant_id as string;
      if (bestCompetitorPrice[key] === undefined || sp < bestCompetitorPrice[key]) {
        bestCompetitorPrice[key] = sp;
      }
    }
  }

  return (
    <DashboardClient
      products={myProducts}
      commissions={(commissions ?? []) as Commission[]}
      sales={sales ?? []}
      bestCompetitorPrice={bestCompetitorPrice}
      vacationMode={p?.vacation_mode ?? false}
      username={p?.discord_username ?? undefined}
    />
  );
}
