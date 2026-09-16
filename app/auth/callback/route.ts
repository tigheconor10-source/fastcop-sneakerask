import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminSupabase } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const discordId = user.identities?.find(i => i.provider === "discord")?.id;
        const discordUsername =
          user.user_metadata?.custom_claims?.global_name ??
          user.user_metadata?.full_name ??
          user.email;

        // Admin client para escribir sin restricciones de RLS
        const admin = createAdminSupabase(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Comprobar si el perfil ya existe
        const { data: existing } = await admin
          .from("profiles")
          .select("id, is_approved, is_admin")
          .eq("id", user.id)
          .maybeSingle();

        if (!existing) {
          // Nuevo usuario — crear con is_approved: false
          await admin.from("profiles").insert({
            id: user.id,
            discord_id: discordId,
            discord_username: discordUsername,
            discord_avatar: user.user_metadata?.avatar_url,
            email: user.email,
            is_approved: false,
            is_admin: false,
          });
        } else {
          // Usuario existente — solo actualizar datos de Discord
          await admin.from("profiles").update({
            discord_id: discordId,
            discord_username: discordUsername,
            discord_avatar: user.user_metadata?.avatar_url,
            email: user.email,
          }).eq("id", user.id);
        }
      }

      const forwardedHost = request.headers.get("x-forwarded-host");
      if (process.env.NODE_ENV === "development") {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}