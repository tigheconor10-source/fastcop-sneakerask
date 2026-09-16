import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import StatusStamp from "@/components/StatusStamp";
import ShippingCountdown from "@/components/ShippingCountdown";
import { isShipmentLate, effectiveShippingDeadline } from "@/lib/lateFees";

type SaleRow = {
  id: string;
  shopify_order_id: string;
  shipping_label_url: string | null;
  shipping_deadline: string | null;
  shipping_extension_hours: number;
  shipped_at: string | null;
  tracking_number: string | null;
  created_at: string;
  products: {
    brand: string;
    model: string;
    size: string;
    photos: string[];
    vat_type: "vat" | "margin_scheme" | null;
  } | null;
};

type CommissionRow = {
  sale_id: string;
  consignor_amount: number;
  status: "pending" | "paid";
};

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  const [{ data: sales }, { data: commissions }] = await Promise.all([
    supabase
      .from("sales")
      .select("id, shopify_order_id, shipping_label_url, shipping_deadline, shipping_extension_hours, shipped_at, tracking_number, created_at, products(brand, model, size, photos, vat_type)")
      .eq("consignor_id", userData.user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("commissions")
      .select("sale_id, consignor_amount, status")
      .eq("consignor_id", userData.user!.id),
  ]);

  const items = (sales ?? []) as unknown as SaleRow[];
  const comms = (commissions ?? []) as CommissionRow[];

  return (
    <div>
      <h1 className="title-page">Orders</h1>
      <p className="mt-1 text-sm text-muted">
        When one of your pairs sells, we'll let you know on Discord.
      </p>

      {items.length === 0 ? (
        <div className="empty-state mt-6">
          You don't have any sales yet.
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {items.map((sale) => {
            const comm = comms.find((c) => c.sale_id === sale.id);
            const status = comm?.status ?? "pending";
            const vatLabel = sale.products?.vat_type === "margin_scheme" ? "Margin scheme" : "VAT";
            const late = isShipmentLate(sale);
            const deadline = effectiveShippingDeadline(sale);

            return (
              <div key={sale.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {sale.products?.photos?.[0] && (
                      <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-surface-hover">
                        <Image src={sale.products.photos[0]} alt="" fill className="object-cover" />
                      </div>
                    )}
                    <div>
                      <p className="font-semibold leading-tight">
                        {sale.products?.brand} {sale.products?.model}
                      </p>
                      <p className="text-xs text-muted">EU {sale.products?.size}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusStamp status={status} />
                    {late && <StatusStamp status="late" />}
                  </div>
                </div>

                <div className="tag-perforation my-3" />

                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted">Payout</p>
                    <p className="font-semibold tabular-nums">
                      {comm ? `€${comm.consignor_amount.toFixed(2)}` : "—"}
                      <span className="ml-1 text-xs font-normal text-muted">({vatLabel})</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Sale date</p>
                    <p className="font-semibold">
                      {new Date(sale.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Reference</p>
                    <p className="font-mono font-semibold">#{sale.shopify_order_id}</p>
                  </div>
                  {sale.shipping_label_url && (
                    <div>
                      <p className="text-xs text-muted">Ship by</p>
                      <ShippingCountdown deadline={deadline} shippedAt={sale.shipped_at} />
                    </div>
                  )}
                  {sale.tracking_number && (
                    <div>
                      <p className="text-xs text-muted">Tracking</p>
                      <p className="font-mono font-semibold">{sale.tracking_number}</p>
                    </div>
                  )}
                </div>

                {sale.shipping_label_url && (
                  <a
                    href={sale.shipping_label_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-border py-2 text-sm font-medium text-accent transition hover:bg-surface-hover"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Download shipping label
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
