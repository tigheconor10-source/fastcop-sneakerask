import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import Image from "next/image";
import type { Profile } from "@/lib/types";

type SellerRow = Profile & { product_count?: number };

export default async function AdminConsignorsPage() {
  const supabase = createAdminClient();

  // Traer todos los perfiles con sus listados activos
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (!profiles || profiles.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted">
        No sellers yet.
      </div>
    );
  }

  // Contar listings activos por seller
  const { data: productCounts } = await supabase
    .from("products")
    .select("consignor_id")
    .eq("status", "published");

  const countByUser: Record<string, number> = {};
  for (const row of productCounts ?? []) {
    countByUser[row.consignor_id] = (countByUser[row.consignor_id] ?? 0) + 1;
  }

  const sellers = (profiles as Profile[]).map((p) => ({
    ...p,
    product_count: countByUser[p.id] ?? 0,
  })) as SellerRow[];

  // Separar: admins primero, luego el resto
  const admins = sellers.filter((s) => s.is_admin);
  const regular = sellers.filter((s) => !s.is_admin);

  const SellerCard = ({ p }: { p: SellerRow }) => (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
      {p.discord_avatar ? (
        <Image
          src={p.discord_avatar}
          alt={p.discord_username ?? "avatar"}
          width={40}
          height={40}
          className="rounded-full"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white text-sm font-bold">
          {(p.discord_username ?? "?")[0]?.toUpperCase()}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold">{p.discord_username ?? "—"}</p>
          {p.is_admin && (
            <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
              ADMIN
            </span>
          )}
          {!p.is_admin && !p.is_approved && (
            <span className="rounded-md bg-yellow-100 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-700">
              PENDING
            </span>
          )}
        </div>
        <p className="truncate text-sm text-muted">{p.email ?? "—"}</p>
      </div>

      <div className="shrink-0 text-right">
        <p className="font-semibold">{p.product_count}</p>
        <p className="text-xs text-muted">live</p>
      </div>

      <Link
        href={`/admin/consignors/${p.id}`}
        className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted transition hover:border-accent hover:text-accent"
      >
        View details
      </Link>
    </div>
  );

  return (
    <div className="space-y-6">
      {admins.length > 0 && (
        <section>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Admins
          </p>
          <div className="space-y-2">
            {admins.map((p) => <SellerCard key={p.id} p={p} />)}
          </div>
        </section>
      )}

      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
          Sellers ({regular.length})
        </p>
        {regular.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted">
            No sellers yet.
          </div>
        ) : (
          <div className="space-y-2">
            {regular.map((p) => <SellerCard key={p.id} p={p} />)}
          </div>
        )}
      </section>
    </div>
  );
}
