import type { MetadataRoute } from 'next';
import { listPublishedPosts } from '@/lib/blog';
import { publicSitemap } from '@/lib/public-discovery';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    return publicSitemap(await listPublishedPosts());
  } catch {
    // Keep the established public documents discoverable during a blog outage.
    console.warn('The sitemap could not load published blog posts. Static public URLs remain available.');
    return publicSitemap();
  }
}
