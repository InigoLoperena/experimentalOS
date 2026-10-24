import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { sectionPaths } from '@/lib/section-routes';
import Home from '../workspace-app';

// Retired menu links remain usable; arbitrary URLs must never open the app shell.
const legacyPaths = ['/experimentos', '/goi-tree/ideas'];
const appPaths = new Set<string>([...Object.values(sectionPaths), ...legacyPaths]);

export const metadata: Metadata = {
  title: 'Espacio de trabajo · Xperiments',
  robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
};

export function generateStaticParams() {
  return [...appPaths].filter(path => path !== sectionPaths.projects)
    .map(path => ({ section: path.slice(1).split('/') }));
}

// Resolve before rendering or streaming the client application so unknown paths
// receive a real HTTP 404 instead of a successful app-shell response.
export default async function SectionPage({ params }: {
  params: Promise<{ section: string[] }>;
}) {
  const { section } = await params;
  if (!appPaths.has('/' + section.join('/'))) notFound();
  return <Home />;
}
