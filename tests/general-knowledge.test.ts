import test from 'node:test';
import assert from 'node:assert/strict';
import {generalKnowledge,currentLibraryHistory} from '../lib/general-knowledge';
import {selectMemory,type MemorySource} from '../lib/ai-memory';

function configure(){
  const env={...process.env},fetch=globalThis.fetch;
  process.env.OPENAI_SHARED_VECTOR_STORE_ID='vs_unit';process.env.OPENAI_LIBRARY_API_KEY='sk-library-central';
  return ()=>{process.env=env;globalThis.fetch=fetch;};
}
const file=(id:string,attributes:Record<string,unknown>={},status='completed')=>({id,status,attributes,created_at:1792100000});
const result=(id:string,text:string,score=0.8)=>({file_id:id,filename:`${id}.md`,score,content:[{type:'text',text}]});

test('general retrieval paginates current membership, excludes private/pending/deleted files and never uploads workspace data',async()=>{
  const restore=configure(),calls:string[]=[];
  globalThis.fetch=async(input,options)=>{
    const url=new URL(String(input));calls.push(url.href);
    assert.equal(url.origin,'https://api.openai.com');assert.equal(options?.redirect,'error');assert.equal(options?.cache,'no-store');
    assert.equal((options?.headers as Record<string,string>).Authorization,'Bearer sk-library-central');
    if(url.pathname.endsWith('/files')){
      assert.equal(options?.method,'GET');
      return Response.json(url.searchParams.get('after')?{data:[file('file-beta',{title:'Guía actual',kind:'methodology'}),file('file-private',{workspace_id:'other-team'}),file('file-pending',{},'in_progress')],has_more:false}:{data:[file('file-alpha')],has_more:true,last_id:'file-alpha'});
    }
    assert.equal(url.pathname,'/v1/vector_stores/vs_unit/search');assert.equal(options?.method,'POST');
    assert.deepEqual(JSON.parse(String(options.body)),{query:'Cómo entrevistar',max_num_results:6,rewrite_query:false,ranking_options:{ranker:'auto',score_threshold:0.15}});
    return Response.json({data:[result('file-beta','Método actual'),result('file-retired','NO_RETIRED'),result('file-private','NO_PRIVATE'),result('file-pending','NO_PENDING'),result('file-alpha','NO_LOW_SCORE',0.01)]});
  };
  try{
    const knowledge=await generalKnowledge('Cómo entrevistar');
    assert.equal(knowledge.storage,'openai');assert.equal(knowledge.status,'ready');assert.equal(knowledge.coverage.available_files,2);
    assert.deepEqual(knowledge.sources.map(s=>s.id),['general:file-beta']);assert.equal(knowledge.sources[0].title,'Guía actual');
    assert.equal(knowledge.sources[0].validation,'methodological_reference');assert.equal(knowledge.sources[0].project_id,null);
    assert.doesNotMatch(JSON.stringify(knowledge),/NO_RETIRED|NO_PRIVATE|NO_PENDING|NO_LOW_SCORE|sk-library-central/);
    assert.equal(calls.length,3);
  }finally{restore();}
});

test('additions, replacements, metadata edits and removals are reflected on the next request without a cache',async()=>{
  const restore=configure();let phase=0;
  globalThis.fetch=async(input)=>{
    if(String(input).includes('/files?'))return Response.json({data:[file(phase?'file-new':'file-old',{title:phase?'Updated guide':'Old guide'})],has_more:false});
    return Response.json({data:[result('file-old','OLD_TEXT'),result('file-new','NEW_TEXT')]});
  };
  try{
    const old=await generalKnowledge('Experimentos');phase++;
    const next=await generalKnowledge('Experimentos');
    assert.equal(old.sources[0].title,'Old guide');assert.equal(next.sources[0].title,'Updated guide');
    assert.match(next.sources[0].excerpt,/NEW_TEXT/);assert.doesNotMatch(JSON.stringify(next),/OLD_TEXT/);
    const history=[{question:'Old',answer:'OLD_TEXT',proposal:{title:'Old'},sources:[{id:'general:file-old'}]},{question:'Private',answer:'My own observation',sources:[{id:'private-source'}]}];
    const current=currentLibraryHistory(history,next.activeSourceIds);
    assert.doesNotMatch(current[0].answer,/OLD_TEXT/);assert.equal(current[0].proposal,null);assert.equal(current[1].answer,history[1].answer);
    assert.equal(history[0].answer,'OLD_TEXT','Stored historical evidence is not deleted or mutated');
  }finally{restore();}
});

for(const mode of ['empty','unauthorized','malformed','loop','bad-store'])test(`a configured ${mode} library never resurrects bundled documents or leaks provider errors`,async()=>{
  const restore=configure();if(mode==='bad-store')process.env.OPENAI_SHARED_VECTOR_STORE_ID='https://evil.test/steal';let count=0;
  globalThis.fetch=async()=>{count++;
    if(mode==='unauthorized')return Response.json({error:{message:'SECRET_CREDENTIAL'}},{status:401});
    if(mode==='malformed')return Response.json({data:[]});
    if(mode==='loop')return Response.json({data:[file('file-loop')],has_more:true,last_id:'file-loop'});
    return Response.json({data:[],has_more:false});
  };
  try{
    const knowledge=await generalKnowledge('Método');
    assert.equal(knowledge.status,mode==='empty'?'empty':'unavailable');assert.deepEqual(knowledge.sources,[]);
    assert.doesNotMatch(JSON.stringify(knowledge),/SECRET_CREDENTIAL|Mom Test|empresa experimental/);
    if(mode==='bad-store')assert.equal(count,0);
  }finally{restore();}
});

test('general context and individual citations are bounded; long requests retain their full original outside retrieval',async()=>{
  const restore=configure();let query='';
  globalThis.fetch=async(input,options)=>{
    if(String(input).includes('/files?'))return Response.json({data:['a','b','c','d','e','f'].map(id=>file(`file-${id}`)),has_more:false});
    query=JSON.parse(String(options?.body)).query;
    return Response.json({data:['a','b','c','d','e','f'].map(id=>result(`file-${id}`,'x'.repeat(10000)))});
  };
  try{
    const knowledge=await generalKnowledge('HEAD'+'q'.repeat(10000)+'TAIL');
    assert.ok(query.length<=2001);assert.ok(query.startsWith('HEAD'));assert.ok(query.endsWith('TAIL'));
    assert.ok(knowledge.sources.every(s=>s.excerpt.length<=3200));assert.ok(knowledge.sources.reduce((s,v)=>s+v.excerpt.length,0)<=12000);
  }finally{restore();}
});

test('legacy installations retain the original methodology until a central store is configured',async()=>{
  const restore=configure();delete process.env.OPENAI_SHARED_VECTOR_STORE_ID;
  globalThis.fetch=async()=>{throw new Error('No API call should be made');};
  try{const knowledge=await generalKnowledge('Método');assert.equal(knowledge.status,'fallback');assert.equal(knowledge.sources.length,3);}finally{restore();}
});

test('selected-project evidence is prioritized without losing shared style or relevant other-project learning',()=>{
  const base={title:'Entrevista',kind:'learning',date:'2026-10-15',excerpt:'Fricción observada'};
  const rows:MemorySource[]=[{...base,id:'other',project_id:'other'},{...base,id:'selected',project_id:'selected'},{...base,id:'style',project_id:null,category:'team_style',validation:'reviewed'}];
  assert.deepEqual(selectMemory(rows,'Entrevista',28000,'selected').selected.map(row=>row.id),['style','selected','other']);
});
