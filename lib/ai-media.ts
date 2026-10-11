export type AiMedia={name:string;kind:'image'|'video_frame';data:string;timestamp:number|null};
export function validateAiMedia(value:unknown):AiMedia[]{
  if(value===undefined)return [];
  if(!Array.isArray(value)||value.length>8)throw new Error('Envía hasta ocho imágenes o fotogramas a la IA.');
  let bytes=0;
  const result=value.map(row=>{
    if(!row||typeof row!=='object'||typeof row.name!=='string'||row.name.length>250||!['image','video_frame'].includes(row.kind)||typeof row.data!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(row.data))throw new Error('Los materiales de la IA no son válidos.');
    const encoded=row.data.split(',')[1];bytes+=encoded.length*3/4;
    if(encoded.length>260000||!encoded.startsWith('/9j/'))throw new Error('Cada imagen para la IA debe ser JPEG y ocupar menos de 190 KB.');
    if(row.timestamp!==null && (typeof row.timestamp!=='number'||!Number.isFinite(row.timestamp)||row.timestamp<0||row.timestamp>180))throw new Error('El fotograma no es válido.');
    return {name:row.name,kind:row.kind,data:row.data,timestamp:row.timestamp} as AiMedia;
  });
  if(bytes>1500000)throw new Error('Reduce los materiales enviados a la IA.');
  return result;
}
