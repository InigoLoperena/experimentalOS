import {test} from 'node:test';
import assert from 'node:assert/strict';
import {experimentCampaignName} from '../lib/campaign-name';
import {smartleadRecipe} from '../lib/smartlead-build';
import {emptyExecution} from '../lib/execution-plan';
import {preparationSchemaForRequest} from '../lib/ai-preparation';
import type {Item} from '../lib/model';
import type {Variant} from '../lib/monitoring';
test('campaign names preserve full experiment title and never silently truncate or expose internal code',()=>{
 assert.equal(experimentCampaignName('Mapa de muebles'),'Experimento · Mapa de muebles');
 for(const title of ['', 'Bad\nname','x'.repeat(200)])assert.throws(()=>experimentCampaignName(title));
 const plan={...emptyExecution(),variants:['A','B'].map(label=>({label,description:null,headline:`Hello ${label}`,body:`Version ${label}`,call_to_action:null,allocation:null}))};
 const e={fields:{channel:'smartlead',execution_config:JSON.stringify(plan)},title:'Mapa de muebles',updated_at:'r'} as unknown as Item;
 const result=smartleadRecipe(e,'EXP-GREENHUNT-0042',[{id:'a',label:'A'},{id:'b',label:'B'}] as Variant[],{key:'private',revision:'r'});
 assert.equal(result.name,'Experimento · Mapa de muebles');assert.equal(result.variants.length,2);
});
test('prompt-only Google and Smartlead preparation guarantees two variants and bounded email subjects',()=>{
 for(const channel of ['google_ads','smartlead'] as const){
  const schema=preparationSchemaForRequest(channel,'Prepara mi campaña').properties.execution.anyOf[0];
  assert.ok('properties' in schema);const variants=schema.properties.variants;assert.ok('minItems' in variants);assert.equal(variants.minItems,2);assert.equal(variants.maxItems,2);
  if(channel==='smartlead')assert.equal(variants.items.properties.headline.maxLength,200);
 }
});
