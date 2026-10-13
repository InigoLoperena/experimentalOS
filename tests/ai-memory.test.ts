import test from 'node:test';
import assert from 'node:assert/strict';
import {knowledgeMemory,parseChat,parseKnowledge,recordMemory,selectMemory,type Knowledge,type MemorySource} from '../lib/ai-memory';

test('memory imports preserve qualitative and quantitative source data without auto-validating it',()=>{
 const text=parseKnowledge(' Entrevistas ','Tres personas solicitaron un mapa.','text','Entrevistas 12/10','unverified');
 assert.equal(text.validation,'unverified');assert.equal(text.title,'Entrevistas');
 const csv='variante,registros,periodo\nA,12,2026-10\nB,8,2026-10';
 assert.equal(parseKnowledge('Resultados',csv,'csv','Exportación','reviewed').content,csv);
 assert.throws(()=>parseKnowledge('Datos','{invalid','json','','unverified'),/JSON/);
 assert.throws(()=>parseKnowledge('Datos','x'.repeat(100001),'text','','unverified'),/100.000/);
 assert.throws(()=>parseKnowledge('Datos','a\u0000b','text','','unverified'),/nulos/);
 assert.throws(()=>parseKnowledge('Datos','a','csv','','unverified'),/cabecera/);
});
test('retrieval ranks older relevant material and later document chunks above unrelated recent records',()=>{
 const docs=knowledgeMemory({id:'old',title:'Notas de entrevistas',content:'x'.repeat(2200)+'Usuarios necesitan rutas nocturnas',format:'text',source:'Entrevistas','validation':'unverified',created_at:'2025-01-01'} as Knowledge);
 const recent:MemorySource={id:'new',title:'Campaña azul',kind:'experiment',excerpt:'Sin relación con el problema',date:'2026-01-01'};
 const memory=selectMemory([recent,...docs],'¿Qué sabemos sobre rutas nocturnas?',700);
 assert.equal(memory.selected[0].id,'old');assert.match(memory.selected[0].excerpt,/nocturnas/);
 assert.equal(memory.coverage.available,3);assert.ok(memory.coverage.included<memory.coverage.available);
 assert.ok(memory.selected.reduce((total,row)=>total+JSON.stringify(row).length,0)<=700);
});
test('chat citations reject invented source IDs, deduplicate document chunks and enforce create permissions',()=>{
 const sources:MemorySource[]=[{id:'real',title:'Uno',kind:'learning',date:'2026-01-01',excerpt:'Dato'},{id:'real',title:'Dos',kind:'learning',date:'2026-01-01',excerpt:'Dato2'}];
 const reply=parseChat({answer:'Es una hipótesis.',source_ids:['fake','real'],proposal:{invalid:true}},sources,false);
 assert.equal(reply.proposal,null);assert.deepEqual(reply.sources.map(row=>row.id),['real']);
 assert.throws(()=>parseChat({answer:'',source_ids:[],proposal:null},sources,true));
});
test('record context excludes provider credentials and preserves learning evidence and decision',()=>{
 const source=recordMemory({id:'record',title:'Aprendizaje',kind:'learning',updated_at:'2026-10-13',parent_id:'experiment',fields:{learning:'La prueba fue inconclusa',evidence:'Muestra pequeña',decision:'Inconcluso',api_key:'secret',execution_config:'huge'}} as never);
 assert.match(source.excerpt,/inconclusa/);assert.match(source.excerpt,/Muestra pequeña/);assert.doesNotMatch(source.excerpt,/secret|huge/);
});
test('invalid optional campaign settings do not erase a valid strategic answer and common experiment fields',()=>{
 const fields=Object.fromEntries(['context','hypothesis','metric','success_criteria','start','tags','secondary_metrics','audience','traffic_plan','risks'].map(key=>[key,null]));
 const proposal={title:'Prueba A/B',fields:{...fields,hypothesis:'Un mapa facilitará encontrar muebles'},missing:[],assumptions:[],questions:[],recommendations:[],channel:'web_app',execution:{goal:'product',destination:'URL por decidir'}};
 const reply=parseChat({answer:'Esta comparación es una hipótesis, no una conclusión.',source_ids:[],proposal},[],true);
 assert.match(reply.answer,/hipótesis/);assert.equal(reply.proposal?.title,'Prueba A/B');assert.equal(reply.proposal?.execution,null);assert.match(reply.warning||'',/configuración/);assert.ok(reply.proposal?.missing.length);
 const invalid=parseChat({answer:'Diseñemos la prueba.',source_ids:[],proposal:{...proposal,title:''}},[],true);
 assert.equal(invalid.proposal,null);assert.ok(invalid.warning);assert.equal(invalid.answer,'Diseñemos la prueba.');
});
