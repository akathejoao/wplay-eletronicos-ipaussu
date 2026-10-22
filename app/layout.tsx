import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WPlay Eletrônicos | Ipaussu",
  description: "Eletrônicos, mobilidade e acessórios em Ipaussu. Consulte a WPlay pelo WhatsApp.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
