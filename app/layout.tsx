import type { Metadata } from "next";
import "./globals.css";
import "./storefront.css";
import "./atmosphere.css";

export const metadata: Metadata = {
  icons: { icon: "/images/wplay-logo-official.png" },
  title: "WPlay Eletrônicos | Ipaussu",
  description: "Eletrônicos, mobilidade e acessórios em Ipaussu. Consulte a WPlay pelo WhatsApp.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
