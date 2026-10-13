import test from 'node:test';
import assert from 'node:assert/strict';
import {openAIFileContent,validateContextDocuments,validatePromptFiles} from '../lib/ai-prompt-files';

const stub=(name:string,size:number)=>({name,size,type:'application/octet-stream'} as File);

test('chat accepts small research files and documents; experiment composer preserves supported record attachments',()=>{
 assert.doesNotThrow(()=>validatePromptFiles([stub('notes.txt',500),stub('evidence.pdf',50000)],'chat'));
 assert.doesNotThrow(()=>validatePromptFiles([stub('evidence.pdf',50000),stub('summary.docx',50000)],'experiment'));
 assert.throws(()=>validatePromptFiles([stub('notes.txt',500)],'experiment'),/Tipo de archivo/);
 assert.throws(()=>validatePromptFiles([stub('wrong.exe',30)],'chat'),/Tipo de archivo/);
 assert.throws(()=>validatePromptFiles(Array.from({length:5},(_,i)=>stub('x'+i+'.pdf',100)),'chat'),/cuatro/);
 assert.throws(()=>validatePromptFiles([stub('huge.pdf',1_500_001)],'chat'),/1,5 MB/);
 assert.throws(()=>validatePromptFiles([stub('one.mp4',100),stub('two.mp4',100),stub('three.mp4',100)],'chat'),/ocho/);
});
test('server only accepts bounded PDF and text; payloads are passed as data rather than instructions',()=>{
 const docs=validateContextDocuments([
  {name:'customer.csv',kind:'text',content:'segment,visits\nnew,22'},
  {name:'paper.pdf',kind:'pdf',data:'data:application/pdf;base64,JVBERi0x'},
 ]);
 assert.equal(docs.length,2);
 const prompt=openAIFileContent(docs,[]);
 assert.equal(prompt[0].type,'input_text');assert.match(prompt[0].text||'',/customer.csv/);
 assert.equal(prompt[2].type,'input_file');assert.equal(prompt[2].filename,'paper.pdf');
 assert.throws(()=>validateContextDocuments([{name:'bad.pdf',kind:'pdf',data:'data:application/pdf;base64,ZmFrZQ=='}]),/PDF/);
 assert.throws(()=>validateContextDocuments([{name:'p.txt',kind:'text',content:'x'.repeat(24_001)}]),/texto/);
 assert.throws(()=>validateContextDocuments([{}]),/Nombre del documento/);
 assert.throws(()=>validateContextDocuments(Array(5).fill({name:'a.txt',kind:'text',content:'ok'})),/cuatro/);
});
