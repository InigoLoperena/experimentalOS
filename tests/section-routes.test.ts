import test from 'node:test';
import assert from 'node:assert/strict';
import {pathForView,sectionPaths,viewForPath} from '../lib/section-routes';
test('all 13 sections have distinct, refreshable direct URLs',()=>{
 const urls=Object.values(sectionPaths);assert.equal(urls.length,13);
 assert.equal(new Set(urls).size,urls.length);
 for(const [view,url] of Object.entries(sectionPaths)){
  assert.equal(viewForPath(url),view);
  assert.equal(viewForPath(url+'/'),view);
  assert.equal(pathForView(view as keyof typeof sectionPaths),url);
 }
});
test('unrecognized paths preserve their existing page routes',()=>{
 assert.equal(viewForPath('/'),'projects');
 assert.equal(viewForPath('/experimentacion-mvps'),'mvp');
 assert.equal(viewForPath('/privacy-policy'),null);
 assert.equal(viewForPath('/guia-investigacion'),null);
 assert.equal(viewForPath('/invalid'),null);
});
