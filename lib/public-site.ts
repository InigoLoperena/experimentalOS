import type { Metadata } from 'next';

/** The production host that serves public documents without a redirect. */
export const SITE_URL = 'https://www.xperiments.site';
export const SITE_NAME = 'Xperiments';
export const SITE_DESCRIPTION = 'Diseña experimentos de negocio con IA, organiza hipótesis y aprende de los resultados en un espacio de trabajo compartido.';

export function publicMetadata({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Public metadata requires a local absolute path.');
  const url = new URL(path, SITE_URL).toString();
  const images = [{ url: `${SITE_URL}/opengraph-image`, width: 1200, height: 630, alt: 'Xperiments · Experimentación de negocio con IA' }];
  return {
    title, description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: SITE_NAME, locale: 'es_AR', type: 'website', images },
    twitter: { card: 'summary_large_image', title, description, images: images.map(image => image.url) },
  };
}

/** Safe inside a script[type="application/ld+json"], including editor-provided titles. */
export function jsonLd(value: unknown): string {
  return (JSON.stringify(value) ?? 'null').replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
