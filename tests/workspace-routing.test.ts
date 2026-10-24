import test from 'node:test';
import assert from 'node:assert/strict';
import SectionPage, { generateStaticParams, metadata } from '../app/[...section]/page';
import { metadata as projectsMetadata } from '../app/proyectos/page';
import { sectionPaths } from '../lib/section-routes';

test('workspace catch-all covers each existing section and only the documented legacy aliases', () => {
  const paths = generateStaticParams().map(({ section }) => '/' + section.join('/'));
  assert.equal(new Set(paths).size, paths.length);
  assert.deepEqual(new Set(paths), new Set([
    ...Object.values(sectionPaths).filter(path => path !== '/proyectos'),
    '/experimentos', '/goi-tree/ideas',
  ]));
});

test('unknown, mis-cased and invented nested paths terminate with the Next.js 404 signal', async () => {
  for (const section of [['missing'], ['PROYECTOS'], ['goi-tree', 'inventado'], ['robots.txt']]) {
    await assert.rejects(
      SectionPage({ params: Promise.resolve({ section }) }),
      (error: unknown) => (error as { digest?: string }).digest === 'NEXT_HTTP_ERROR_FALLBACK;404',
    );
  }
});

test('workspace and project pages discourage indexing without suppressing link discovery', () => {
  for (const pageMetadata of [metadata, projectsMetadata]) {
    assert.deepEqual(pageMetadata.robots, {
      index: false, follow: true, googleBot: { index: false, follow: true },
    });
  }
});
