import Link from "next/link";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { isProfileComplete } from "@/lib/profile";
import ApproveConsignorButton from "@/components/ApproveConsignorButton";

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}

export default async function ConsignorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const p = profile as Profile | null;

  if (!p) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted">
        Seller not found.
      </div>
    );
  }

  const { count: liveCount } = await admin
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("consignor_id", id)
    .eq("status", "published");

  const complete = isProfileComplete(p);

  return (
    <div className="mx-auto max-w-lg">
      <Link href="/admin/consignors" className="text-sm text-muted underline">
        ← Back to sellers
      </Link>

      <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
        {p.discord_avatar ? (
          <Image
            src={p.discord_avatar}
            alt={p.discord_username ?? "avatar"}
            width={48}
            height={48}
            className="rounded-full"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white font-bold">
            {(p.discord_username ?? "?")[0]?.toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold">{p.discord_username ?? "—"}</p>
            {p.is_admin && (
              <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                ADMIN
              </span>
            )}
            {p.is_approved ? (
              <span className="rounded-md bg-status-sold/10 px-1.5 py-0.5 text-[10px] font-semibold text-status-sold">
                APPROVED
              </span>
            ) : (
              <span className="rounded-md bg-status-pending/10 px-1.5 py-0.5 text-[10px] font-semibold text-status-pending">
                PENDING
              </span>
            )}
          </div>
          <p className="text-sm text-muted">{p.email ?? "—"}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-semibold">{liveCount ?? 0}</p>
          <p className="text-xs text-muted">live</p>
        </div>
      </div>

      {/* Botones aprobar / denegar */}
      {!p.is_admin && (
        <div className="mt-4 flex gap-3">
          <ApproveConsignorButton id={p.id} isApproved={p.is_approved} />
        </div>
      )}

      {!complete && !p.is_admin && (
        <div className="mt-4 rounded-xl border border-status-pending/20 bg-status-pending/8 px-4 py-3 text-sm text-status-pending">
          ⚠️ This seller hasn't completed their Settings yet.
        </div>
      )}

      <div className="mt-4 rounded-xl border border-border bg-surface p-4 sm:p-5">
        <p className="mb-4 text-sm font-semibold">Seller information</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Full name" value={p.full_name} /></div>
          <Field label="ID / Passport number" value={p.id_number} />
          <Field label="Phone number" value={p.phone} />
          <div className="sm:col-span-2"><Field label="Address" value={p.address} /></div>
          <Field label="City" value={p.city} />
          <Field label="ZIP / Postal code" value={p.zip_code} />
          <Field label="Country" value={p.country} />
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-surface p-4 sm:p-5">
        <p className="mb-4 text-sm font-semibold">Payout details</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Bank account holder name" value={p.bank_account_holder} /></div>
          <Field label="IBAN" value={p.iban} />
          <Field label="BIC / SWIFT" value={p.bic_swift} />
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-surface p-4 sm:p-5">
        <p className="mb-4 text-sm font-semibold">Account</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Discord ID" value={p.discord_id} />
          <Field label="Vacation mode" value={p.vacation_mode ? "Active" : "Off"} />
          <div className="sm:col-span-2">
            <Field label="Joined" value={new Date(p.created_at).toLocaleDateString("en-GB")} />
          </div>
        </div>
      </div>
    </div>
  );
}
