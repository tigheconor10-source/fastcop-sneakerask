import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles").select("*").eq("id", userData.user.id).single();

  if (!(profile as Profile)?.is_admin) redirect("/dashboard");

  // admin (service_role) en vez del cliente de sesión: si RLS bloquea la
  // lectura de estas tablas para el rol autenticado normal, estas queries
  // devolverían counts en 0 silenciosamente en vez de fallar con un error
  // visible — mejor no depender de eso aquí.
  const [{ count: totalSellers }, { count: pendingIssues }, { count: pendingPayouts }, { data: recentSales }] =
    await Promise.all([
      admin.from("profiles").select("*", { count: "exact", head: true }).eq("is_approved", true),
      admin.from("products").select("*", { count: "exact", head: true }).eq("status", "rejected"),
      admin.from("commissions").select("*", { count: "exact", head: true }).eq("status", "pending"),
      admin.from("commissions").select("consignor_amount").eq("status", "pending"),
    ]);

  const pendingAmount = (recentSales ?? []).reduce((s: number, c: any) => s + c.consignor_amount, 0);

  const TABS = [
    { href: "/admin", label: "Issues", badge: pendingIssues ?? 0 },
    { href: "/admin/consignors", label: "Sellers", badge: totalSellers ?? 0 },
    { href: "/admin/payouts", label: "Payouts", badge: pendingPayouts ?? 0 },
    { href: "/admin/orders", label: "Orders" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="label-eyebrow">Fastcop</p>
          <h1 className="title-page mt-1">Admin</h1>
        </div>
        <Link href="/dashboard" className="btn btn-secondary btn-sm">Back to dashboard</Link>
      </div>

      {/* Quick metrics */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4">
          <p className="metric text-2xl">{totalSellers ?? 0}</p>
          <p className="mt-1 text-xs text-muted">Active sellers</p>
        </div>
        <div className={`card p-4 ${(pendingIssues ?? 0) > 0 ? "border-status-rejected/35" : ""}`}>
          <p className={`metric text-2xl ${(pendingIssues ?? 0) > 0 ? "text-status-rejected" : ""}`}>{pendingIssues ?? 0}</p>
          <p className="mt-1 text-xs text-muted">Issues</p>
        </div>
        <div className={`rounded-xl border bg-surface p-3 ${(pendingPayouts ?? 0) > 0 ? "border-accent/30" : "border-border"}`}>
          <p className={`metric text-2xl ${(pendingPayouts ?? 0) > 0 ? "text-accent" : ""}`}>{pendingPayouts ?? 0}</p>
          <p className="mt-1 text-xs text-muted">Pending payouts</p>
        </div>
        <div className="card p-4">
          <p className="metric text-2xl">€{pendingAmount.toFixed(0)}</p>
          <p className="mt-1 text-xs text-muted">To pay out</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 inline-flex gap-1 overflow-x-auto rounded-lg bg-surface-2 p-1">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex items-center gap-2 whitespace-nowrap rounded-md px-3.5 py-1.5 text-sm text-muted transition-colors duration-150 hover:text-foreground aria-[current=page]:bg-surface aria-[current=page]:font-medium aria-[current=page]:text-foreground aria-[current=page]:shadow-[var(--shadow-xs)]"
          >
            {tab.label}
            {tab.badge != null && tab.badge > 0 && (
              <span className="font-mono text-[11px] tabular-nums text-faint">{tab.badge}</span>
            )}
          </Link>
        ))}
      </div>

      {children}
    </div>
  );
}
