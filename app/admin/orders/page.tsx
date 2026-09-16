import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import StatusStamp from "@/components/StatusStamp";
import UploadLabelButton from "@/components/UploadLabelButton";
import OrderRowActions from "@/components/OrderRowActions";
import MarkPaidButton from "@/components/MarkPaidButton";
import ExtendShippingTimeButton from "@/components/ExtendShippingTimeButton";
import ShippingCountdown from "@/components/ShippingCountdown";
import ShippedCheckbox from "@/components/ShippedCheckbox";
import TrackingNumberInput from "@/components/TrackingNumberInput";
import { isShipmentLate, effectiveShippingDeadline, LATE_SHIPPING_PENALTY } from "@/lib/lateFees";

type OrderRow = {
  id: string;
  shopify_order_id: string;
  sale_price: number;
  shipping_label_url: string | null;
  shipping_deadline: string | null;
  shipping_extension_hours: number;
  shipped_at: string | null;
  tracking_number: string | null;
  created_at: string;
  products: { brand: string; model: string; size: string; photos: string[] } | null;
  profiles: { discord_username: string | null; full_name: string | null } | null;
};

type CommissionRow = {
  id: string;
  sale_id: string;
  status: "pending" | "paid";
};

export default async function AdminOrdersPage() {
  const supabase = await createClient();

  const [{ data: sales }, { data: commissions }] = await Promise.all([
    supabase
      .from("sales")
      .select("*, products(brand, model, size, photos), profiles(discord_username, full_name)")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("commissions").select("id, sale_id, status"),
  ]);

  const items = (sales ?? []) as unknown as OrderRow[];
  const comms = (commissions ?? []) as CommissionRow[];

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted">
        No orders yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-surface-hover">
          <tr>
            <th className="px-4 py-3 font-medium text-muted">Item</th>
            <th className="px-4 py-3 font-medium text-muted">Seller</th>
            <th className="px-4 py-3 font-medium text-muted">Order</th>
            <th className="px-4 py-3 text-right font-medium text-muted">Sale price</th>
            <th className="px-4 py-3 font-medium text-muted">Status</th>
            <th className="px-4 py-3 font-medium text-muted">Ship by</th>
            <th className="px-4 py-3 font-medium text-muted">Label</th>
            <th className="px-4 py-3 font-medium text-muted">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((s) => {
            const commission = comms.find((c) => c.sale_id === s.id);
            const status = commission?.status ?? "pending";
            const late = isShipmentLate(s);
            const deadline = effectiveShippingDeadline(s);
            const showMarkPaid = status === "pending" && commission;

            return (
              <tr key={s.id} className="border-t border-border hover:bg-surface-hover/40 transition">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {s.products?.photos?.[0] && (
                      <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-surface-hover">
                        <Image src={s.products.photos[0]} alt="" fill className="object-cover" />
                      </div>
                    )}
                    <div>
                      <p className="font-semibold leading-tight">
                        {s.products?.brand} {s.products?.model}
                      </p>
                      <p className="text-xs text-muted">EU {s.products?.size}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted">
                  {s.profiles?.discord_username ?? s.profiles?.full_name ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="font-mono text-xs text-muted">#{s.shopify_order_id}</div>
                  <div className="text-xs text-muted">{new Date(s.created_at).toLocaleDateString("en-GB")}</div>
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold">
                  €{s.sale_price.toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-1">
                    <StatusStamp status={status} />
                    {late && <StatusStamp status="late" />}
                    {showMarkPaid && <MarkPaidButton commissionId={commission!.id} />}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {!s.shipping_label_url ? (
                    <span className="text-xs text-muted">Waiting for label</span>
                  ) : (
                    <div className="space-y-1">
                      <ShippingCountdown deadline={deadline} shippedAt={s.shipped_at} />
                      {deadline && !s.shipped_at && (
                        <p className="text-[10px] text-muted">
                          by {deadline.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          {late && ` · −€${LATE_SHIPPING_PENALTY} if paid now`}
                        </p>
                      )}
                      {s.shipping_extension_hours > 0 && (
                        <p className="text-[10px] text-muted">+{s.shipping_extension_hours}h granted</p>
                      )}
                      <div className="flex items-center gap-3 pt-0.5">
                        <ShippedCheckbox saleId={s.id} shipped={!!s.shipped_at} />
                        {!s.shipped_at && <ExtendShippingTimeButton saleId={s.id} />}
                      </div>
                      <div className="pt-0.5">
                        <TrackingNumberInput saleId={s.id} value={s.tracking_number} />
                      </div>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1.5">
                    {s.shipping_label_url && (
                      <a
                        href={s.shipping_label_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-accent underline"
                      >
                        View label ↗
                      </a>
                    )}
                    <UploadLabelButton saleId={s.id} />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <OrderRowActions saleId={s.id} salePrice={s.sale_price} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
