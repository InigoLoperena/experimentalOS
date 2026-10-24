import type { Metadata } from "next";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/public-site";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Xperiments · Experimentación de negocio con IA",
  description: SITE_DESCRIPTION,
  openGraph: { siteName: SITE_NAME, locale: "es_AR", type: "website", images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Xperiments · Experimentación de negocio con IA" }] },
  twitter: { card: "summary_large_image", images: ["/opengraph-image"] },
  icons: { icon: "/favicon.svg" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
