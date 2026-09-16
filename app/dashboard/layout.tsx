import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import { isProfileComplete } from "@/lib/profile";
import type { Profile } from "@/lib/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) redirect("/login");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .maybeSingle();

  const p = profile as Profile | null;
  const profileComplete = p?.is_admin ? true : isProfileComplete(p);

  return (
    <div className="min-h-dvh bg-background">
      <Sidebar profile={p} profileComplete={profileComplete} />
      {/* El contenido se desplaza para dejar sitio a la barra lateral en
          escritorio; en móvil ocupa todo y deja hueco para la barra
          inferior de pestañas. */}
      <main
        id="main"
        className="px-5 pb-28 pt-6 sm:px-8 sm:pt-8 lg:pl-[var(--sidebar-w)] lg:pb-12"
      >
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
