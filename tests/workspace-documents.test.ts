import {test} from 'node:test';
import assert from 'node:assert/strict';
import {zipSync,strToU8,unzipSync} from 'fflate';
import {jsPDF} from 'jspdf';
import {documentText} from '../lib/ai-document-text';
import {createBackupArchive} from '../lib/backup-archive';
import type {Backup} from '../lib/backup';
test('private originals yield real PDF, DOCX and UTF-8 text without AI or invented visual content',async()=>{
 const pdf=new jsPDF();pdf.text('Interview: free furniture map',20,20);const data=new Uint8Array(pdf.output('arraybuffer'));
 assert.match((await documentText('interview.pdf',data)).text,/free furniture map/);
 const docx=zipSync({'word/document.xml':strToU8('<w:document><w:p><w:r><w:t>Questions &amp; hypotheses</w:t></w:r></w:p><w:p><w:r><w:t>Second paragraph</w:t></w:r></w:p></w:document>')});
 assert.equal((await documentText('notes.docx',docx)).text,'Questions & hypotheses\nSecond paragraph');
 assert.equal((await documentText('data.csv',strToU8('variant,users\nA,12'))).text,'variant,users\nA,12');
 assert.equal((await documentText('photo.png',new Uint8Array([1,2]))).text,'');
 await assert.rejects(documentText('broken.pdf',strToU8('not a PDF')),/PDF/);
 await assert.rejects(documentText('large.txt',strToU8('x'.repeat(100001))),/100.000/);
});
test('export includes workspace original bytes and refuses an incomplete memory backup',async()=>{
 const backup:Backup={schema_version:8,workspace_id:'w',exported_at:'2026-10-15',records:[],members:[],attachments:[],audit:[],notes:[],monitoring:{ai_documents:[{id:'document',name:'notes.txt',size:3}]}};
 const bytes=await createBackupArchive(backup,'data.json',strToU8('{}'),async()=>new Uint8Array(),()=>{},async()=>new Uint8Array([1,2,3]));
 assert.deepEqual([...unzipSync(bytes)['memoria/document-notes.txt']],[1,2,3]);
 await assert.rejects(createBackupArchive(backup,'data.json',strToU8('{}'),async()=>new Uint8Array(),()=>{}),/incompleta/);
});
