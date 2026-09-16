import { createClient } from "@/lib/supabase/server";
import StatusStamp from "@/components/StatusStamp";
import SepaPayoutsSection, { type SepaPendingItem } from "@/components/SepaPayoutsSection";
import { isShipmentLate, LATE_SHIPPING_PENALTY } from "@/lib/lateFees";

type CommissionRow = {
  id: string;
  sale_price: number;
  fastcop_fee: number;
  consignor_amount: number;
  status: "pending" | "paid";
  late_penalty: number;
  created_at: string;
  profiles: { discord_username: string | null; full_name: string | null; bank_account_holder: string | null; iban: string | null } | null;
  sales: {
    shopify_order_id: string;
    shipping_deadline: string | null;
    shipping_extension_hours: number;
    shipped_at: string | null;
  } | null;
};

export default async function AdminPayoutsPage() {
  const supabase = await createClient();

  const { data: commissions } = await supabase
    .from("commissions")
    .select(
      "id, sale_price, fastcop_fee, consignor_amount, status, late_penalty, created_at, profiles(discord_username, full_name, bank_account_holder, iban), sales(shopify_order_id, shipping_deadline, shipping_extension_hours, shipped_at)"
    )
    .order("status", { ascending: true })
    .order("created_at", { ascending: false });

  const items = (commissions ?? []) as unknown as CommissionRow[];

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted">
        No payouts yet.
      </div>
    );
  }

  const pending = items.filter((c) => c.status === "pending");
  const paid = items.filter((c) => c.status === "paid");

  const pendingItems: SepaPendingItem[] = pending.map((c) => ({
    id: c.id,
    seller: c.profiles?.discord_username ?? c.profiles?.full_name ?? "—",
    iban: c.profiles?.iban ?? null,
    amount: c.consignor_amount,
    orderRef: c.sales?.shopify_order_id ? `Order #${c.sales.shopify_order_id}` : "—",
    late: c.sales ? isShipmentLate(c.sales) : false,
  }));

  return (
    <div className="space-y-8">
      {/* Pending: selección + generador SEPA */}
      {pending.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Pending — select sellers to pay this run
          </h2>
          <SepaPayoutsSection items={pendingItems} />
        </section>
      )}

      {/* Paid */}
      {paid.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Paid</h2>
          <div className="space-y-2">
            {paid.map((c) => {
              const seller = c.profiles?.discord_username ?? c.profiles?.full_name ?? "—";
              return (
                <div key={c.id} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 opacity-60 sm:flex-row sm:items-center">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{seller}</p>
                      <StatusStamp status={c.status} />
                    </div>
                    <p className="mt-0.5 font-mono text-xs text-muted truncate">
                      IBAN: {c.profiles?.iban ?? "—"}
                      {c.sales?.shopify_order_id && ` · Order #${c.sales.shopify_order_id}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">€{(c.consignor_amount - c.late_penalty).toFixed(2)}</p>
                    {c.late_penalty > 0 && (
                      <p className="text-xs text-status-rejected">−€{c.late_penalty.toFixed(2)} late penalty</p>
                    )}
                    <p className="text-xs text-muted">{new Date(c.created_at).toLocaleDateString("en-GB")}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

    </div>
  );
}
