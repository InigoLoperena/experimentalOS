import {test} from 'node:test';
import assert from 'node:assert/strict';
import {metricoolJson,metricoolBrand,metricoolPublished,metricoolPosts,metricoolPeriod} from '../lib/metricool';
const connection={userId:'5189018',blogId:'6744178',token:'private-test-token'};
test('Metricool confines reads to fixed origin and puts credentials only in headers',async()=>{
 let called=false;
 const fetcher=(async(url:URL,init:RequestInit)=>{called=true;assert.equal(url.origin,'https://app.metricool.com');assert.equal(url.searchParams.get('userId'),connection.userId);assert.equal(url.searchParams.get('blogId'),connection.blogId);assert.ok(!url.href.includes(connection.token));assert.equal((init.headers as Record<string,string>)['X-Mc-Auth'],connection.token);assert.equal(init.redirect,'error');assert.equal(init.method,'GET');return Response.json({data:[]});}) as typeof fetch;
 await metricoolJson(connection,'/v2/scheduler/posts',{},fetcher);assert.ok(called);
 await assert.rejects(()=>metricoolJson(connection,'https://evil.test/api',{},fetcher));
 const rejected=(async()=>new Response(connection.token,{status:403})) as typeof fetch;
 await assert.rejects(()=>metricoolJson(connection,'/v2/scheduler/posts',{},rejected),err=>!String(err).includes(connection.token));
});
test('Metricool confirms configured brand and rejects incomplete pages before importing',async()=>{
 const fetcher=(async()=>Response.json({data:[{id:6744178,label:'Greenhunt',timezone:'Europe/Madrid',networksData:{instagramData:'greenhunt'}}]})) as typeof fetch;
 assert.equal((await metricoolBrand(connection,fetcher)).name,'Greenhunt');
 await assert.rejects(()=>metricoolBrand({...connection,blogId:'999'},fetcher));
 const paged=(async()=>Response.json({data:[],page:{next:'https://evil.test/?token=secret'}})) as typeof fetch;
 await assert.rejects(()=>metricoolPosts(connection,'instagram','2026-10-01','2026-10-10','UTC',paged),/más páginas/);
});
test('Metricool preserves missing metrics, zeroes and network-qualified IDs without deprecated Instagram counts',()=>{
 const p=metricoolPublished({postId:'123',url:'javascript:alert(1)',likes:0,views:23,reach:null,impressions:99,clicks:55,engagement:8},'instagram','2026-10-01','2026-10-10');
 assert.equal(p.id,'instagram:123');assert.equal(p.url,null);assert.deepEqual(p.metrics.map(m=>[m.metric,m.value]),[['likes',0],['views',23]]);
 assert.ok(p.metrics.every(m=>m.notes.includes('acumulado')));
 const t=metricoolPublished({videoId:'123',viewCount:90,likeCount:2},'tiktok','2026-10-01','2026-10-10');assert.equal(t.id,'tiktok:123');
 assert.throws(()=>metricoolPublished({postId:'../../secret'},'instagram','2026-10-01','2026-10-10'));
 assert.throws(()=>metricoolPeriod('2026-02-30','2026-03-01'));assert.throws(()=>metricoolPeriod('2026-01-01','2026-03-01'));
});
