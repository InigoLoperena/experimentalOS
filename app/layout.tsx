import type { Metadata } from "next";
import "./globals.css";
import {GlobalDictation} from "./global-dictation";
export const metadata: Metadata = {
  title: "Xperiments · Experimental Innovation OS",
  description:
    "Xperiments de Imagine Builder: proyectos, North Star, Growth Tree, experimentos y aprendizajes en un espacio compartido.",
  icons: { icon: "/favicon.svg" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}<GlobalDictation/></body>
    </html>
  );
}
