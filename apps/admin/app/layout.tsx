import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "GeoLynq · Radar de cobertura", template: "%s · GeoLynq" },
  description: "Painel de cobertura de revendedores: onde seu produto é procurado e ainda não é encontrado.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0a1f2c", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
