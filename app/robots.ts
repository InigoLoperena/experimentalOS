import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/public-site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Leave HTML shells crawlable so search engines can see their noindex tags.
      // Session validation and RLS, never robots.txt, protect workspace data.
      disallow: ['/api/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
