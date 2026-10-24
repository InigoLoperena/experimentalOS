import { listPublishedPosts } from '@/lib/blog';
import { publicRss } from '@/lib/public-discovery';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return new Response(publicRss(await listPublishedPosts()), { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' } });
  } catch {
    return new Response('El feed no está disponible temporalmente.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '300', 'Cache-Control': 'no-store' } });
  }
}
