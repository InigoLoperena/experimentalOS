import type { Metadata } from "next";
import "./globals.css";
import {GlobalDictation} from "./global-dictation";
export const metadata: Metadata = {
  title: "Experimental Innovation OS · Imagine Builder",
  description:
    "Experimental Innovation OS de Imagine Builder: proyectos, North Star, Growth Tree, experimentos y aprendizajes en un espacio compartido.",
  icons: { icon: "/favicon.svg" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}<GlobalDictation/></body>
    </html>
  );
}
