import {ApiError} from './server-access';

// Bound the bytes while reading, including chunked requests without Content-Length.
// Call only after authentication; malformed input must never reach a provider.
export async function readJsonBody(request:Request,maxBytes:number):Promise<Record<string,any>>{
 if(Number(request.headers.get('content-length')||0)>maxBytes)throw new ApiError('La solicitud es demasiado larga. Reduce el contenido.',413);
 const reader=request.body?.getReader();if(!reader)throw new ApiError('La solicitud no contiene datos.',400);
 const chunks:Uint8Array[]=[];let size=0;
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   size+=value.byteLength;
   if(size>maxBytes){await reader.cancel().catch(()=>{});throw new ApiError('La solicitud es demasiado larga. Reduce el contenido.',413);}
   chunks.push(value);
  }
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 let body;try{body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new ApiError('La solicitud no contiene JSON válido.',400);}
 if(!body||typeof body!=='object'||Array.isArray(body))throw new ApiError('La solicitud debe contener un objeto válido.',400);
 return body;
}
