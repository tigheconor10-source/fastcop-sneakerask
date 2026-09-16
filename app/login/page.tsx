"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDiscordLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "discord",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      // Si Supabase devuelve error, el navegador no llega a redirigir y el
      // usuario se quedaba mirando un botón cargando para siempre.
      if (authError) {
        setError("We couldn't reach Discord. Please try again.");
        setLoading(false);
      }
    } catch {
      setError("We couldn't reach Discord. Please try again.");
      setLoading(false);
    }
  };

  return (
    <main
      id="main"
      className="relative flex min-h-dvh flex-col justify-center px-6 py-16"
    >
      {/* Luz ambiental muy tenue, cálida — da profundidad sin que se note
          como un "blob" de color puesto encima. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[45vh] bg-[radial-gradient(ellipse_55%_100%_at_50%_0%,rgba(47,93,80,0.06),transparent_70%)]"
      />

      <div className="relative mx-auto w-full max-w-[26rem]">
        <p className="label-eyebrow">Fastcop</p>
        <h1 className="title-page mt-2 text-[2rem]">Consignment portal</h1>
        <p className="prose-measure mt-3 text-[15px] text-muted">
          Sign in with the Discord account you use in the Fastcop server. Your
          listings, sales and payouts all live here.
        </p>

        <button
          onClick={handleDiscordLogin}
          disabled={loading}
          className="btn btn-primary btn-lg btn-block mt-8"
        >
          {loading ? (
            "Opening Discord…"
          ) : (
            <>
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3c-.21.375-.444.875-.608 1.265a18.27 18.27 0 0 0-5.487 0A12.6 12.6 0 0 0 9.855 3a19.736 19.736 0 0 0-3.76 1.37C3.83 7.91 3.07 11.36 3.32 14.76a19.9 19.9 0 0 0 6.073 3.08c.486-.66.92-1.36 1.292-2.098a12.9 12.9 0 0 1-2.043-.99c.171-.128.34-.262.502-.4a14.09 14.09 0 0 0 11.71 0c.163.138.331.272.502.4-.65.39-1.337.722-2.043.99.372.738.806 1.438 1.292 2.098a19.9 19.9 0 0 0 6.073-3.08c.296-3.83-.598-7.246-2.36-10.391ZM9.96 13.07c-.798 0-1.451-.732-1.451-1.633 0-.9.64-1.633 1.451-1.633.818 0 1.464.74 1.451 1.633 0 .9-.64 1.633-1.451 1.633Zm6.08 0c-.798 0-1.45-.732-1.45-1.633 0-.9.64-1.633 1.45-1.633.818 0 1.464.74 1.451 1.633 0 .9-.633 1.633-1.451 1.633Z" />
              </svg>
              Continue with Discord
            </>
          )}
        </button>

        {error && <p className="callout callout-danger mt-4">{error}</p>}

        <div className="mt-10 border-t border-border pt-5">
          <p className="text-[13px] leading-relaxed text-muted">
            Not in the Fastcop Discord server yet? You&apos;ll need an invite
            before you can sign in.
          </p>
        </div>
      </div>
    </main>
  );
}
