import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rankwerk — KI-Shop-Optimierungs-Autopilot",
  description:
    "Autonomer KI-Agent, der deinen WooCommerce/Shopify-Shop fortlaufend optimiert: Content, Structured Data, Produkttexte, SEO- Rankings — datengetrieben, markensicher, nicht-destruktiv.",
  keywords: [
    "KI SEO Optimierung",
    "WooCommerce Optimierung",
    "Shopify SEO Agent",
    "automatisierte Shop-Optimierung",
    "Rankwerk",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={inter.variable}>
      <body className="font-sans antialiased min-h-screen bg-ink-950 text-ink-50">
        {children}
      </body>
    </html>
  );
}
