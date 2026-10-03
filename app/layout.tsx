import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Experimental OS · Laboratorio de crecimiento",
  description:
    "North Star, GOI Tree, OKR y experimentos en un espacio compartido.",
  icons: { icon: "/favicon.svg" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
