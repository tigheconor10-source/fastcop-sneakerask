import "./globals.css";

export const metadata = {
  title: "FastCop → sneakerask",
  description: "Vigilante de precios y anuncios en sneakerask",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
