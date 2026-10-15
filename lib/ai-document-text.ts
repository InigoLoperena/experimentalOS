import {unzipSync,strFromU8} from 'fflate';
export async function documentText(name:string,bytes:Uint8Array):Promise<{text:string;note:string}>{
 let text='';
 if(/\.pdf$/i.test(name)){
  if(strFromU8(bytes.subarray(0,5))!=='%PDF-')throw new Error('El archivo no es un PDF válido.');
  const {getDocumentProxy,extractText}=await import('unpdf');
  const pdf=await getDocumentProxy(new Uint8Array(bytes));
  try{if(pdf.numPages>200)throw new Error('El PDF supera las 200 páginas. Divide una copia para indexarlo; el original está conservado.');
   text=(await extractText(pdf,{mergePages:true})).text;
  }finally{await (pdf as typeof pdf&{destroy?:()=>Promise<void>}).destroy?.();}
 }else if(/\.docx$/i.test(name)){
  const files=unzipSync(bytes,{filter:f=>{if(f.name!=='word/document.xml')return false;if(f.originalSize>2000000)throw new Error('El texto DOCX es demasiado grande. Divide una copia para indexarlo.');return true;}});
  if(!files['word/document.xml'])throw new Error('El DOCX no contiene texto legible.');
  text=strFromU8(files['word/document.xml']).replace(/<\/w:p>/g,'\n').replace(/<w:tab\b[^>]*\/>/g,'\t').replace(/<[^>]*>/g,'').replace(/&#(x[0-9a-f]+|\d+);|&(amp|lt|gt|quot|apos);/gi,(_,n,entity)=>n?String.fromCodePoint(n[0]==='x'?parseInt(n.slice(1),16):Number(n)):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"} as Record<string,string>)[entity]);
 }else if(/\.(txt|csv|json|md)$/i.test(name))text=new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,'');
 else return {text:'',note:'Original conservado. Imagen o vídeo: consulta su contenido con la IA y guarda el análisis revisado como aprendizaje; no se ha indexado su contenido visual ni audio.'};
 text=text.replace(/\u0000/g,'').trim();
 if(text.length>100000)throw new Error('El texto supera 100.000 caracteres. El original está conservado; divide una copia para indexarlo sin perder contenido.');
 return {text,note:text?'Texto extraído e indexado sin validación humana. Revisa tablas y el orden de lectura.':'Original conservado, sin texto extraíble. Si es un escaneo, aporta una versión con texto o transcripción.'};
}
