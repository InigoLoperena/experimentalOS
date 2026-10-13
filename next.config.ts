import type { NextConfig } from "next";
import {sectionPaths} from "./lib/section-routes";
const config: NextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: process.cwd(),
  async rewrites() {
    return Object.values(sectionPaths).map(path => ({source:path,destination:"/"}));
  },
};
export default config;
