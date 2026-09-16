import { createClient } from "@/lib/supabase/server";
import RetryRemoveButtons from "@/components/RetryRemoveButtons";
import Image from "next/image";

type FailedProduct = {
  id: string;
  brand: string;
  model: string;
  size: string;
  desired_price: number;
  photos: string[];
  admin_notes: string | null;
  created_at: string;
  profiles: {
    discord_username: string | null;
  } | null;
};

// Todo lo que se envía se publica directamente en Shopify. Esta página solo
// muestra los listados que fallaron al crearse en Shopify (status =
// "rejected"), para poder reintentarlos o eliminarlos.
export default async function AdminIssuesPage() {
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select(
      "id, brand, model, size, desired_price, photos, admin_notes, created_at, profiles(discord_username)"
    )
    .eq("status", "rejected")
    .order("created_at", { ascending: false });

  const items = (products ?? []) as unknown as FailedProduct[];

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted">
        No issues — everything published correctly.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((p) => (
        <div key={p.id} className="rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex gap-2 overflow-x-auto sm:w-24 sm:flex-shrink-0">
              {p.photos.map((src, i) => (
                <div
                  key={i}
                  className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-md bg-surface-hover"
                >
                  <Image src={src} alt="" fill className="object-cover" />
                </div>
              ))}
            </div>

            <div className="flex-1">
              <p className="font-medium">
                {p.brand} {p.model}{" "}
                <span className="font-mono text-sm text-muted">
                  · EU {p.size}
                </span>
              </p>
              <p className="text-sm text-muted">
                Seller: {p.profiles?.discord_username ?? "—"} · Payout{" "}
                €{p.desired_price.toFixed(2)}
              </p>
              {p.admin_notes && (
                <p className="mt-2 rounded-md bg-status-rejected/10 px-2 py-1 font-mono text-xs text-status-rejected">
                  {p.admin_notes}
                </p>
              )}

              <RetryRemoveButtons productId={p.id} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
