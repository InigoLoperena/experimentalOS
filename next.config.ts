import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: process.cwd(),
  images: { qualities: [75, 85] },
  async headers() {
    // These filenames can change: revalidate after an hour, never cache them immutable for a year.
    const headers = [{ key: 'Cache-Control', value: 'public, max-age=3600, must-revalidate' }];
    return ['/logo.svg', '/favicon.svg', '/einstein-project-ia-hd.png', '/methodology-books/:path*', '/export-fonts/:path*'].map(source => ({ source, headers }));
  },
};
export default config;
