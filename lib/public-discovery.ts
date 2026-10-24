import type { MetadataRoute } from 'next';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from './public-site';

/** Public editorial documents only: never add workspace or private file URLs here. */
export const PUBLIC_DOCUMENT_PATHS = [
  '/', '/blog', '/agentes', '/guia-investigacion', '/privacy-policy',
  '/plugins/validacion-de-negocios',
  '/plugins/validacion-de-negocios/soporte',
  '/plugins/validacion-de-negocios/privacidad',
  '/plugins/validacion-de-negocios/terminos',
] as const;

export type PublicPostSummary = {
  slug: string; title: string; excerpt: string; status: string;
  published_at: string | null; updated_at: string;
};

export function publishedSummaries(posts: readonly PublicPostSummary[], now = Date.now()): PublicPostSummary[] {
  return posts.filter(post => post.status === 'published'
    && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug)
    && post.published_at !== null
    && Number.isFinite(Date.parse(post.published_at))
    && Date.parse(post.published_at) <= now);
}

export function publicSitemap(posts: readonly PublicPostSummary[] = [], now = Date.now()): MetadataRoute.Sitemap {
  return [
    ...PUBLIC_DOCUMENT_PATHS.map(path => ({ url: `${SITE_URL}${path}` })),
    ...publishedSummaries(posts, now).map(post => ({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: Number.isFinite(Date.parse(post.updated_at)) ? post.updated_at : post.published_at!,
    })),
  ];
}

export function xmlText(value: string): string {
  return value.replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function publicRss(posts: readonly PublicPostSummary[], now = Date.now()): string {
  const items = publishedSummaries(posts, now).map(post => {
    const link = `${SITE_URL}/blog/${post.slug}`;
    return `<item><title>${xmlText(post.title)}</title><link>${link}</link><guid isPermaLink="true">${link}</guid><description>${xmlText(post.excerpt)}</description><pubDate>${new Date(post.published_at!).toUTCString()}</pubDate></item>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${SITE_NAME} · Blog</title><link>${SITE_URL}/blog</link><description>${xmlText(SITE_DESCRIPTION)}</description><language>es</language><atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>${items}</channel></rss>`;
}
