import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Experimental Operative System · Imagine Builder",
  description:
    "Experimental Operative System de Imagine Builder: proyectos, North Star, GOI Tree, experimentos y aprendizajes en un espacio compartido.",
  icons: { icon: "/favicon.svg" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
