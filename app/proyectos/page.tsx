import type { Metadata } from "next";
import Home from "../workspace-app";

export const metadata: Metadata = {
  title: "Proyectos · Xperiments",
  robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
};

// The workspace keeps its existing direct URL independently of the public landing.
export default Home;
