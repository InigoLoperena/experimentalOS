import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyExecution,parseExecution} from '../lib/execution-plan';
import {emptyGooglePlay,parseGooglePlay} from '../lib/google-play-options';
import {googlePlayPreparation} from '../lib/google-play-preparation';
import {parsePreparation,applyPreparation,preparationKeys} from '../lib/ai-preparation';
import type {Item} from '../lib/model';
const play={...emptyGooglePlay(),type:'localized' as const,language:'es-ES',asset:'short_description' as const,metric:'install_clicks' as const,audience:50};
const variant={label:'Nueva propuesta',description:null,headline:null,body:'Da otra vida a los muebles.',call_to_action:null,allocation:null,media_names:[]};
const experiment=(execution:unknown)=>({id:'exp',kind:'experiment',title:'Test',fields:{channel:'google_play',execution_config:JSON.stringify(execution)}} as unknown as Item);
test('Play preparation preserves control and generates distinct local result references without publishing',()=>{
 const result=googlePlayPreparation(experiment({...emptyExecution(),play,variants:[variant,{...variant,label:'Segunda propuesta'}]}),'EXP-001');
 assert.equal(result.publication,'manual_in_play_console');assert.equal(result.control,'Ficha actual de la tienda');
 assert.equal(result.variants.length,2);assert.notEqual(result.variants[0].reference,result.variants[1].reference);
 assert.throws(()=>googlePlayPreparation(experiment({...emptyExecution(),play,variants:[{...variant,body:'x'.repeat(81)}]}),'EXP-001'),/80/);
 assert.throws(()=>googlePlayPreparation(experiment({...emptyExecution(),play,variants:Array.from({length:3},(_,i)=>({...variant,label:`V${i}`}))}),'EXP-001'),/una o dos/);
});
test('Play validation rejects invalid traffic, text in graphics tests, unsafe locales and missing media',()=>{
 for(const audience of [0,100,NaN,-1])assert.throws(()=>parseGooglePlay({...play,audience}));
 assert.throws(()=>parseGooglePlay({...play,type:'graphics'}));
 assert.throws(()=>parseGooglePlay({...play,language:'../../en'}));
 assert.throws(()=>googlePlayPreparation(experiment({...emptyExecution(),play:{...play,type:'graphics',asset:'icon'},variants:[variant]}),'EXP-001'),/materiales/);
 assert.equal(parseExecution(emptyExecution()).play,undefined);
});
test('AI Play options survive save, and a later unknown proposal retains human configuration',()=>{
 const proposal=parsePreparation({title:'Test',fields:Object.fromEntries(preparationKeys.map(k=>[k,null])),missing:[],assumptions:[],channel:'google_play',execution:{...emptyExecution(),play,variants:[variant]}});
 const fields=applyPreparation({},proposal);assert.deepEqual(JSON.parse(String(fields.execution_config)).play,play);
 const next=applyPreparation(fields,{...proposal,execution:{...emptyExecution(),play:null}});
 assert.deepEqual(JSON.parse(String(next.execution_config)).play,play);
});
