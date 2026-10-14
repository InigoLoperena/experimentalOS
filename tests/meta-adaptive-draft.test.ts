import {test} from 'node:test';
import assert from 'node:assert/strict';
import {automaticMetaSelection} from '../lib/meta-auto-selection';
import {metaDraftDefaults} from '../lib/meta-draft-defaults';
import {buildMetaRecipe,metaStepPayload} from '../lib/meta-build';
import {emptyExecution} from '../lib/execution-plan';
import {emptyGoogleAds} from '../lib/google-ads-options';
import {emptyMeta} from '../lib/meta-options';
import {item} from './service-fixture';
import type {Attachment} from '../lib/attachments';
import type {Variant} from '../lib/monitoring';
const e='11111111-1111-4111-8111-111111111111';
const files=['valorization.png','tutorial-report.png'].map((name,i)=>({id:`${i+2}2222222-2222-4222-8222-222222222222`,name,kind:'image',record_id:e,workspace_id:'w',storage_path:`w/${e}/${name}`,mime_type:'image/png'})) as Attachment[];
const plan={...emptyExecution(),meta:null,goal:'traffic' as const,destination:'https://greenhunt.example.com/',google:{...emptyGoogleAds(),type:'DISPLAY' as const,countries:['US']},variants:[{label:'A · Ganancias y sostenibilidad',description:null,headline:'Gana dinero con fotos',body:'Descubre Greenhunt',call_to_action:'LEARN_MORE',allocation:null,media_names:['objetos_urbano1.jpg']},{label:'B · Mapa y descubrimiento urbano',description:null,headline:'Encuentra objetos en un mapa',body:'Explora tu ciudad',call_to_action:'LEARN_MORE',allocation:null,media_names:['mapa_objetos.jpg']}]};
test('the reported stale filenames and missing Meta settings produce a complete paused recipe using real attachments',()=>{
 const exp={...item(e),workspace_id:'w',title:'Campaña test A/B Greenhunt',fields:{channel:'meta_ads',execution_config:JSON.stringify(plan)}};
 const selection=automaticMetaSelection(plan,files,undefined,0);
 assert.equal(selection.assignments.length,6);assert.equal(new Set(selection.assignments.map(a=>a.attachment_id)).size,2);
 const defaults=metaDraftDefaults(exp,{...item('project'),title:'Greenhunt',fields:{site_url:'https://greenhunt.net/'}},selection,{currency:'USD',pageId:'456'});
 const variants=plan.variants.map((v,i)=>({id:`variant-${i}`,label:v.label})) as Variant[];
 const recipe=buildMetaRecipe(defaults.experiment,'EXP-GREENHUNT-0042',defaults.selection,files,variants,{accountId:'123',pageId:'456',instagramId:'789',currency:'USD',revision:'original'},0);
 assert.equal(recipe.destination,'https://greenhunt.net/');assert.equal(recipe.total,1000);assert.equal(recipe.currency,'USD');assert.equal(recipe.steps.filter(step=>step.kind==='ad').length,6);
 assert.ok(recipe.steps.filter(step=>step.attachment).every(step=>files.some(file=>file.id===step.attachment!.id)));
 assert.equal(plan.daily_budget,null);assert.equal(plan.meta,null);assert.equal(plan.destination,'https://greenhunt.example.com/'); // reviewed defaults do not mutate user input
 for(const step of recipe.steps.filter(step=>['campaign','adset','ad'].includes(step.kind))){const result=Object.fromEntries(recipe.steps.map(step=>[step.key,{id:'1234',hash:'hash'}]));assert.equal(metaStepPayload(recipe,step,result).status,'PAUSED');}
 assert.ok(defaults.notes.some(note=>note.includes('10 USD')));
});
test('explicit B assignment is reserved, prefixes and duplicate names are resolved, and a single image can be reused',()=>{
 const selected=automaticMetaSelection({...plan,variants:[plan.variants[0],{...plan.variants[1],media_names:['valorization.png']}]},files,undefined,0);
 assert.ok(selected.assignments.filter(row=>row.variant===plan.variants[1].label).every(row=>row.attachment_id===files[0].id));
 assert.ok(selected.assignments.filter(row=>row.variant===plan.variants[0].label).every(row=>row.attachment_id===files[1].id));
 const duplicate={...files[0],id:'44444444-4444-4444-8444-444444444444'};
 assert.doesNotThrow(()=>automaticMetaSelection({...plan,variants:plan.variants.map(v=>({...v,media_names:['valorization']}))},[...files,duplicate],undefined,0));
 assert.ok(automaticMetaSelection(plan,[files[0]],undefined,0).assignments.every(row=>row.attachment_id===files[0].id));
 assert.throws(()=>automaticMetaSelection(plan,[],undefined,0),/No hay ninguna imagen/);
});
test('human budget, real destination and targeting survive defaulting; missing conversion tracking is explicit',()=>{
 const explicit={...plan,daily_budget:25,destination:'https://greenhunt.net/offer',meta:{...emptyMeta(),objective:'leads' as const,countries:['ES'],conversion_event:'LEAD' as const}};
 const exp={...item(e),fields:{channel:'meta_ads',execution_config:JSON.stringify(explicit)}};
 const defaults=metaDraftDefaults(exp,{...item('project'),fields:{}},automaticMetaSelection(explicit,files,undefined,0),{currency:'USD',pixelId:'123'});
 const decoded=JSON.parse(String(defaults.experiment.fields.execution_config));assert.equal(decoded.daily_budget,25);assert.equal(decoded.destination,explicit.destination);assert.deepEqual(defaults.selection.meta.countries,['ES']);assert.equal(defaults.selection.meta.objective,'leads');
 const noPixel=metaDraftDefaults(exp,{...item('project'),fields:{}},automaticMetaSelection(explicit,files,undefined,0),{currency:'USD',pageId:'456'});
 assert.equal(noPixel.selection.meta.objective,'traffic');assert.ok(noPixel.notes.some(note=>note.includes('No optimiza ni mide registros')));
});
