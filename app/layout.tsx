import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./storefront.css";
import "./atmosphere.css";
import "./app-install.css";

export const metadata: Metadata = {
  manifest: "/manifest.json",
  icons: {
    icon: "/images/wplay-logo-official.png",
    apple: "/icons/apple-touch-icon.png",
  },
  title: "WPlay Eletrônicos | Ipaussu",
  description: "Eletrônicos, mobilidade e acessórios em Ipaussu. App e catálogo interativo WPlay.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "WPlay",
  },
};

export const viewport: Viewport = {
  themeColor: "#060809",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>{children}</body>
    </html>
  );
}
