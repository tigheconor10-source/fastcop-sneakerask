import { createClient, createAdminClient } from "@/lib/supabase/server";
import SettingsForm from "@/components/SettingsForm";
import VacationToggle from "@/components/VacationToggle";
import type { Profile } from "@/lib/types";
import Image from "next/image";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ onboarding?: string }>;
}) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const params = await searchParams;
  const isOnboarding = params.onboarding === "1";

  const admin = createAdminClient();

  let { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", userData.user!.id)
    .maybeSingle();

  // Si el perfil no existe, lo creamos
  if (!profile) {
    const user = userData.user!;
    const meta = user.user_metadata ?? {};

    await admin.from("profiles").upsert({
      id: user.id,
      discord_id: meta.provider_id ?? null,
      discord_username: meta.full_name ?? meta.name ?? null,
      discord_avatar: meta.avatar_url ?? null,
      email: user.email ?? null,
    }, { onConflict: "id" });

    const { data: newProfile } = await admin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    profile = newProfile;
  }

  const p = profile as Profile | null;

  return (
    <div className="mx-auto max-w-lg">
      {isOnboarding && (
        <div className="mb-6 rounded-xl border border-accent/30 bg-accent/5 px-4 py-4">
          <p className="font-semibold text-accent">Welcome to Fastcop Consignment 👋</p>
          <p className="mt-1 text-sm text-muted">
            Complete all the fields below before you can list anything. We
            need your contact details, address and bank account to process
            payouts and shipping.
          </p>
        </div>
      )}

      <h1 className="mb-4 text-2xl font-bold tracking-tight">Settings</h1>

      {p ? (
        <>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
            {p.discord_avatar ? (
              <Image
                src={p.discord_avatar}
                alt={p.discord_username ?? "avatar"}
                width={44}
                height={44}
                className="rounded-full"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-white font-bold">
                {(p.discord_username ?? "?")[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-semibold">{p.discord_username ?? "—"}</p>
              <p className="text-sm text-muted">{p.email ?? "—"}</p>
            </div>
          </div>

          <SettingsForm profile={p} isOnboarding={isOnboarding} />

          {!isOnboarding && (
            <div className="mt-8 border-t border-border pt-6">
              <p className="mb-3 text-sm font-medium">Vacation mode</p>
              <VacationToggle
                active={p.vacation_mode}
                pausedCount={p.vacation_paused_ids?.length ?? 0}
              />
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-status-rejected">
          Something went wrong loading your profile. Please refresh the page.
        </p>
      )}
    </div>
  );
}
