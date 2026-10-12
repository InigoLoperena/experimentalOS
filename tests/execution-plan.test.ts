import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyExecution,parseChannel,parseExecution,executionFromFields} from '../lib/execution-plan';
import {applyPreparation,parsePreparation,preparationKeys,requiredPreparation} from '../lib/ai-preparation';
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
  assert.throws(()=>parseChannel('constructor'));
  assert.ok(requiredPreparation({...proposal,channel:'meta_ads'},0).missing.some(row=>row.includes('creatividades')));
  const variant={label:'A',description:'Humana',headline:'Titular revisado',body:'Texto revisado',call_to_action:'Ver más',allocation:100};
  const revised=applyPreparation({execution_config:JSON.stringify({...old,variants:[variant]})},{...proposal,execution:{...emptyExecution(),variants:[{...variant,description:'Nueva propuesta',headline:null,body:null,call_to_action:null,allocation:null}]}});
  assert.deepEqual(executionFromFields(revised)?.variants[0],{...variant,description:'Nueva propuesta'});
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

test('bare campaign domains work with image proposals while malformed destinations remain rejected',()=>{
  const proposal=parsePreparation({title:'Dos anuncios',fields:Object.fromEntries(preparationKeys.map(k=>[k,null])),channel:'meta_ads',execution:{...emptyExecution(),destination:'greenhunt.net'},missing:[],assumptions:[]});
  const current={channel:'meta_ads',execution_config:JSON.stringify({...emptyExecution(),destination:' greenhunt.net/landing?variant=a#map '})};
  assert.equal(executionFromFields(current)?.destination,'https://greenhunt.net/landing?variant=a#map');
  assert.equal(executionFromFields(cleanExperimentFields(current))?.destination,'https://greenhunt.net/landing?variant=a#map');
  assert.equal(proposal.execution?.destination,'https://greenhunt.net/');
  assert.equal(executionFromFields(applyPreparation(current,proposal))?.destination,'https://greenhunt.net/');
  const images=['fdfdfgdfd.jpg','sasasa.PNG'].map(name=>({name,kind:'image',data:'data:image/jpeg;base64,/9j/AAAA',timestamp:null}));
  assert.equal(validateAiMedia(images).length,2);
  for(const destination of ['greenhunt','/landing','https://','greenhunt.net/a b','user:pass@greenhunt.net','https://user:pass@greenhunt.net','http://greenhunt.net','javascript:alert(1)','data:text/plain,test']){
    assert.throws(()=>parseExecution({...emptyExecution(),destination}),/Revisa la URL de destino/);
  }
  assert.equal(parseExecution({...emptyExecution(),destination:'  '}).destination,null);
});
