import "./globals.css";

export const metadata = {
  title: "FastCop Ops",
  description: "Gestión de anuncios y precios",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
