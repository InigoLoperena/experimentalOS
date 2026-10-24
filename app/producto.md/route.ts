import { publicProductMarkdown } from '@/lib/product-content';
export function GET() { return new Response(publicProductMarkdown(),{headers:{'Content-Type':'text/markdown; charset=utf-8','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, follow','Link':'<https://www.xperiments.site/>; rel="canonical"','Cache-Control':'public, max-age=300'}}); }
