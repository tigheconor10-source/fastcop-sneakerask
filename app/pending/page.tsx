import { createAdminClient, createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import Image from "next/image";

export default async function PendingPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .maybeSingle();

  // Si ya está aprobado, mandar al dashboard
  if (profile?.is_approved) redirect("/dashboard");

  return (
    <main
      id="main"
      className="flex min-h-dvh flex-col justify-center px-6 py-16"
    >
      <div className="mx-auto w-full max-w-[26rem]">
        <p className="label-eyebrow">Fastcop</p>
        <h1 className="title-page mt-2 text-[1.875rem]">Waiting for approval</h1>
        <p className="prose-measure mt-3 text-[15px] text-muted">
          Your account is with the Fastcop team for review. We&apos;ll open up
          the portal as soon as it&apos;s approved — you don&apos;t need to do
          anything else.
        </p>

        {profile?.discord_username && (
          <div className="card mt-7 flex items-center gap-3 p-4">
            {profile.discord_avatar ? (
              <Image
                src={profile.discord_avatar}
                alt=""
                width={40}
                height={40}
                className="rounded-lg"
              />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2 text-sm font-semibold text-muted">
                {profile.discord_username.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {profile.discord_username}
              </p>
              {profile.email && (
                <p className="truncate text-xs text-muted">{profile.email}</p>
              )}
            </div>
            <span className="badge ml-auto bg-[var(--status-pending-bg)] text-[var(--status-pending)]">
              <span className="badge-dot" aria-hidden="true" />
              In review
            </span>
          </div>
        )}

        <form action={signOut} className="mt-7 border-t border-border pt-5">
          <button type="submit" className="btn btn-ghost btn-sm -ml-2.5">
            Log out
          </button>
        </form>
      </div>
    </main>
  );
}
