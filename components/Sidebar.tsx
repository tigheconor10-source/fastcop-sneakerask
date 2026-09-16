"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

type IconProps = { className?: string };

const Icons = {
  grid: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </svg>
  ),
  box: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 8.5v7a2 2 0 0 1-1 1.74l-7 3.9a2 2 0 0 1-2 0l-7-3.9A2 2 0 0 1 3 15.5v-7" />
      <path d="m3.3 7.6 8.7 4.9 8.7-4.9M12 21.5v-9" />
      <path d="M11 2.36a2 2 0 0 1 2 0l7 3.9a.5.5 0 0 1 0 .87l-7.5 4.2a1 1 0 0 1-1 0L4 7.13a.5.5 0 0 1 0-.87Z" />
    </svg>
  ),
  wallet: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M20 8V6.5A1.5 1.5 0 0 0 18.5 5H5a2 2 0 0 0 0 4h14a1 1 0 0 1 1 1v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6.5" />
      <circle cx="16.5" cy="13.5" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  ),
  sliders: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" {...p}>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2.1" />
      <circle cx="9" cy="17" r="2.1" />
    </svg>
  ),
  shield: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 3l7 3v6c0 4.2-2.9 7.8-7 9-4.1-1.2-7-4.8-7-9V6z" />
      <path d="m9.2 12 2 2 3.6-3.8" />
    </svg>
  ),
  plus: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  logout: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M14 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8M17.5 15.5 21 12l-3.5-3.5M21 12H9" />
    </svg>
  ),
};

const NAV = [
  { href: "/dashboard", label: "Listings", icon: Icons.grid, exact: true },
  { href: "/dashboard/orders", label: "Orders", icon: Icons.box },
  { href: "/dashboard/payouts", label: "Payouts", icon: Icons.wallet },
  { href: "/dashboard/settings", label: "Settings", icon: Icons.sliders },
];

export default function Sidebar({
  profile,
  profileComplete,
}: {
  profile: Profile | null;
  profileComplete?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <>
      {/* ---------- Escritorio: barra lateral fija ---------- */}
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-[var(--sidebar-w)] flex-col border-r border-border bg-surface lg:flex"
        aria-label="Main navigation"
      >
        <div className="flex h-16 items-center px-5">
          <Link
            href="/dashboard"
            className="group flex items-baseline gap-px text-[15px] font-semibold tracking-[-0.02em]"
          >
            Fastcop.
          </Link>
        </div>

        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map((item) => {
            const active = isActive(item.href, item.exact);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors duration-150 ${
                  active
                    ? "bg-surface-2 font-medium text-foreground"
                    : "text-muted hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                <Icon className={`h-[18px] w-[18px] ${active ? "text-accent" : ""}`} />
                {item.label}
                {item.href === "/dashboard/settings" && !profileComplete && (
                  <span
                    className="ml-auto h-1.5 w-1.5 rounded-full bg-status-pending"
                    aria-label="Profile incomplete"
                  />
                )}
              </Link>
            );
          })}

          {profile?.is_admin && (
            <>
              <div className="my-3 px-2.5">
                <div className="divider" />
              </div>
              <Link
                href="/admin"
                aria-current={pathname.startsWith("/admin") ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors duration-150 ${
                  pathname.startsWith("/admin")
                    ? "bg-surface-2 font-medium text-foreground"
                    : "text-muted hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                <Icons.shield
                  className={`h-[18px] w-[18px] ${
                    pathname.startsWith("/admin") ? "text-accent" : ""
                  }`}
                />
                Admin
              </Link>
            </>
          )}
        </nav>

        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2.5 px-1.5 py-1.5">
            {profile?.discord_avatar ? (
              <Image
                src={profile.discord_avatar}
                alt=""
                width={28}
                height={28}
                className="rounded-md"
              />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-2 text-[11px] font-medium text-muted">
                {(profile?.discord_username ?? "?").charAt(0).toUpperCase()}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
              {profile?.discord_username ?? "Account"}
            </span>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              aria-label="Log out"
              title="Log out"
              className="btn btn-ghost -mr-1 p-1.5"
            >
              <Icons.logout className="h-[17px] w-[17px]" />
            </button>
          </div>
        </div>
      </aside>

      {/* ---------- Móvil: cabecera arriba ---------- */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-surface px-4 lg:hidden">
        <Link
          href="/dashboard"
          className="flex items-baseline gap-px text-[15px] font-semibold tracking-[-0.02em]"
        >
          Fastcop.
        </Link>
        <div className="flex items-center gap-1.5">
          {profile?.is_admin && (
            <Link href="/admin" className="btn btn-ghost btn-sm">
              Admin
            </Link>
          )}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            aria-label="Log out"
            className="btn btn-ghost btn-sm p-1.5"
          >
            <Icons.logout className="h-[17px] w-[17px]" />
          </button>
        </div>
      </header>

      {/* ---------- Móvil: barra de pestañas inferior ----------
           En el móvil la navegación va abajo, al alcance del pulgar,
           en vez de obligar a subir a una barra superior. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Main navigation"
      >
        {NAV.slice(0, 2).map((item) => {
          const active = isActive(item.href, item.exact);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 py-2 text-[10px] transition-colors duration-150 ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              <Icon className="h-[19px] w-[19px]" />
              {item.label}
            </Link>
          );
        })}

        {NAV.slice(2).map((item) => {
          const active = isActive(item.href, item.exact);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex flex-col items-center gap-1 py-2 text-[10px] transition-colors duration-150 ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              <Icon className="h-[19px] w-[19px]" />
              {item.label}
              {item.href === "/dashboard/settings" && !profileComplete && (
                <span className="absolute right-[26%] top-1.5 h-1.5 w-1.5 rounded-full bg-status-pending" />
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
