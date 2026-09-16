import { createClient } from "@/lib/supabase/server";
import StatusStamp from "@/components/StatusStamp";
import type { Commission } from "@/lib/types";

export default async function PayoutsPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  const { data: commissions } = await supabase
    .from("commissions")
    .select("*")
    .eq("consignor_id", userData.user!.id)
    .order("created_at", { ascending: false });

  const items = (commissions ?? []) as Commission[];

  const pendingTotal = items
    .filter((c) => c.status === "pending")
    .reduce((sum, c) => sum + c.consignor_amount, 0);

  return (
    <div>
      <h1 className="title-page">Payouts</h1>
      <p className="mt-1 text-sm text-muted">
        The amount you're owed for each sale.
      </p>

      <div className="card mt-5 p-5">
        <p className="label-eyebrow">Awaiting payout</p>
        <p className="metric mt-1.5 text-[2rem]">€{pendingTotal.toFixed(2)}</p>
      </div>

      {items.length === 0 ? (
        <div className="empty-state mt-6">
          <p className="title-section">No payouts yet</p>
          <p className="mt-1.5 text-sm text-muted">
            Your share of each sale will appear here once a pair sells.
          </p>
        </div>
      ) : (
        <div className="card mt-6 overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Sale</th>
                <th>Fee</th>
                <th>You receive</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td className="num text-muted">
                    {new Date(c.created_at).toLocaleDateString("en-GB")}
                  </td>
                  <td className="num">
                    €{c.sale_price.toFixed(2)}
                  </td>
                  <td className="num text-muted">
                    €{c.fastcop_fee.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 font-mono font-medium">
                    €{c.consignor_amount.toFixed(2)}
                  </td>
                  <td>
                    <StatusStamp status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-muted">
        Payouts are sent by bank transfer to the IBAN in{" "}
        <a href="/dashboard/settings" className="text-accent underline">
          Settings
        </a>
        . Fastcop marks each row as "Paid" once the transfer is sent.
      </p>
    </div>
  );
}
