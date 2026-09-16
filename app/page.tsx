import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// La página de inicio simplemente redirige: si hay sesión, al dashboard;
// si no, al login.
export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (data.user) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
