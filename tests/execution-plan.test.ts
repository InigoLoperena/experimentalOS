import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyExecution,parseChannel,parseExecution,executionFromFields} from '../lib/execution-plan';
import {applyPreparation,parsePreparation,preparationKeys} from '../lib/ai-preparation';
import {cleanExperimentFields} from '../lib/experiments';
import {validateAiMedia} from '../lib/ai-media';
import {attachmentFileType} from '../lib/attachments';

test('execution proposals preserve the chosen channel and unknown human settings',()=>{
  const old={...emptyExecution(),destination:'https://greenhunt.net/',daily_budget:10,currency:'USD'};
  const proposal=parsePreparation({title:'Prueba',fields:Object.fromEntries(preparationKeys.map(k=>[k,null])),channel:'google_ads',execution:emptyExecution(),missing:[],assumptions:[]});
  const fields=applyPreparation({channel:'meta_ads',execution_config:JSON.stringify(old),impact:7},proposal);
  assert.equal(fields.channel,'meta_ads');assert.equal(executionFromFields(fields)?.daily_budget,10);
  assert.equal(executionFromFields(fields)?.destination,old.destination);
  assert.equal(cleanExperimentFields(fields).execution_config,fields.execution_config);
  for(const channel of ['web_app','mobile_ios','mobile_android','app_store','google_play','meta_ads','google_ads','metricool','smartlead'])assert.equal(parseChannel(channel),channel);
  assert.throws(()=>parseChannel('made_up'));
});
test('invalid financial values, duplicate variants and unsafe destinations are rejected',()=>{
  const base=emptyExecution();
  for(const value of [{...base,destination:'javascript:alert(1)'},{...base,daily_budget:-1},{...base,currency:'dollar'},{...base,duration_days:1.5}])assert.throws(()=>parseExecution(value));
  const variant={label:'A',description:null,headline:null,body:null,call_to_action:null,allocation:50};
  assert.throws(()=>parseExecution({...base,variants:[variant,variant]}));
  assert.throws(()=>parseExecution({...base,variants:[variant]}));
  assert.equal(parseExecution({...base,variants:[variant,{...variant,label:'B'}]}).variants.length,2);
});
test('multimodal payload is bounded and cannot fetch arbitrary URLs',()=>{
  const image={name:'foto.jpg',kind:'image',data:'data:image/jpeg;base64,/9j/AAAA',timestamp:null};
  assert.equal(validateAiMedia([image]).length,1);
  for(const value of [[{...image,data:'https://internal.example'}],[{...image,data:'data:image/svg+xml;base64,PHN2Zz4='}],Array(9).fill(image),[{...image,timestamp:181}],[{...image,data:'data:image/jpeg;base64,'+'A'.repeat(270000)}]])assert.throws(()=>validateAiMedia(value));
  assert.equal(attachmentFileType({name:'creative.mp4',type:'video/mp4',size:100}).kind,'video');
  assert.throws(()=>attachmentFileType({name:'creative.mp4',type:'text/html',size:100}));
});
