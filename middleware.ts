// middleware.ts
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js"; // añade esto
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const user = data.user;

  if (!user && (path.startsWith("/dashboard") || path.startsWith("/admin") || path.startsWith("/pending"))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && path === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (user && path.startsWith("/dashboard")) {
    // ← ADMIN CLIENT para leer profiles sin depender de RLS
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: profile } = await adminClient
      .from("profiles")
      .select("is_approved, is_admin, full_name, iban, bank_account_holder, address, city, zip_code, country, phone")
      .eq("id", user.id)
      .single();

    // Si no existe perfil todavía → pending
    if (!profile || (!profile.is_approved && !profile.is_admin)) {
      return NextResponse.redirect(new URL("/pending", request.url));
    }

    const incomplete = !profile.is_admin && (
      !profile.full_name?.trim() ||
      !profile.iban?.trim() ||
      !profile.bank_account_holder?.trim() ||
      !profile.address?.trim() ||
      !profile.city?.trim() ||
      !profile.zip_code?.trim() ||
      !profile.country?.trim() ||
      !profile.phone?.trim()
    );

    if (incomplete && !path.startsWith("/dashboard/settings")) {
      return NextResponse.redirect(new URL("/dashboard/settings?onboarding=1", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};