import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseMetricsCsv,metricsCsvTemplate,csvObservationPayload,safeResourceUrl,periodRows,type ExternalResource,type Observation} from '../lib/monitoring';
import type {Item} from '../lib/model';
import {parsePreparation,applyPreparation,preparationKeys,humanSuccessCriterion} from '../lib/ai-preparation';

test('CSV validates evidence, handles quoted notes, and refuses duplicate/invalid observations',()=>{
  const rows=parseMetricsCsv('\uFEFF'+metricsCsvTemplate.replace(/,\n/,',"Fuente, con comillas ""y""\nsegunda línea"\n'));
  assert.equal(rows[0].value,120);assert.equal(rows[0].notes,'Fuente, con comillas "y"\nsegunda línea');
  for(const invalid of [metricsCsvTemplate.replace('120','1.5'),metricsCsvTemplate.replace('2026-10-01','2026-02-30'),metricsCsvTemplate.replace('120','-1'),metricsCsvTemplate.replace('120',''),metricsCsvTemplate+metricsCsvTemplate.split('\n')[1]+'\n',metricsCsvTemplate.replace('count','ratio')]) assert.throws(()=>parseMetricsCsv(invalid));
  assert.throws(()=>parseMetricsCsv(metricsCsvTemplate+'"unterminated'));
});
test('resource links and imports stay scoped, and overlapping results are not summed',()=>{
  assert.equal(safeResourceUrl('https://example.org'), 'https://example.org/');
  for(const url of ['javascript:alert(1)','http://example.org','https://user:pass@example.org']) assert.throws(()=>safeResourceUrl(url));
  const experiment={id:'e',workspace_id:'w',project_id:'p',kind:'experiment'} as Item;
  const resource={id:'r',external_id:'123456',experiment_id:'e',workspace_id:'w',project_id:'p'} as ExternalResource;
  assert.equal(csvObservationPayload(experiment,[resource],parseMetricsCsv(metricsCsvTemplate))[0].resource_id,'r');
  assert.throws(()=>csvObservationPayload(experiment,[{...resource,workspace_id:'foreign'}],parseMetricsCsv(metricsCsvTemplate)));
  assert.throws(()=>csvObservationPayload(experiment,[resource,{...resource,id:'another'}],parseMetricsCsv(metricsCsvTemplate)));
  const observations=[{period_start:'2026-10-01',period_end:'2026-10-07',value:10},{period_start:'2026-10-01',period_end:'2026-10-08',value:20}] as Observation[];
  assert.deepEqual(periodRows(observations,'2026-10-01','2026-10-07'),[observations[0]]);
});
test('AI proposal only fills allowed fields and preserves unknown fields and human values',()=>{
  const value={title:'Experimento',fields:Object.fromEntries(preparationKeys.map(key=>[key,key==='hypothesis' ? 'Hipótesis nueva' : null])),missing:['Fecha'],assumptions:['Por validar']};
  const proposal=parsePreparation(value);
  const invented={...proposal,fields:{...proposal.fields,success_criteria:'Mejorar un 15%'}};
  assert.equal(humanSuccessCriterion(invented,'').fields.success_criteria,null);
  assert.equal(humanSuccessCriterion(invented,'Mi criterio validado').fields.success_criteria,'Mi criterio validado');
  assert.ok(humanSuccessCriterion(invented,null).missing.some(value=>value.includes('criterio de éxito')));
  assert.deepEqual(applyPreparation({metric:'Métrica real',impact:7,posthog_experiment_id:'42'},proposal),{metric:'Métrica real',impact:7,posthog_experiment_id:'42',hypothesis:'Hipótesis nueva'});
  assert.throws(()=>parsePreparation({...value,fields:{...value.fields,start:'2026-02-30'}}));
  assert.throws(()=>parsePreparation({...value,fields:{...value.fields,metric:42}}));
});
