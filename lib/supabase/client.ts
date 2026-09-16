import { createBrowserClient } from "@supabase/ssr";

// Cliente de Supabase para usarlo en componentes que corren en el navegador
// (formularios, botones de login, etc.)
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
