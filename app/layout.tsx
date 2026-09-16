import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Fastcop Consignment",
    template: "%s · Fastcop Consignment",
  },
  description:
    "Consignment portal for Fastcop sellers. List your pairs, track sales and get paid.",
  openGraph: {
    title: "Fastcop Consignment",
    description:
      "Consignment portal for Fastcop sellers. List your pairs, track sales and get paid.",
    type: "website",
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#faf9f7",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Tipografía: Geist para todo y Geist Mono para cifras.
            Se precarga la conexión para que el texto no aparezca
            de golpe a media carga. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">
        {/* Salto directo al contenido: imprescindible para quien navega
            con teclado y no quiere tabular por todo el menú cada vez. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
