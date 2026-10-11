// Server routes only. Never import this module into a client component.
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import type {Connection} from './integrations';
import {ApiError} from './server-access';
type Bound=Pick<Connection,'workspace_id'|'project_id'|'provider'|'config'>;
function key(value=process.env.INTEGRATIONS_ENCRYPTION_KEY){
 if(!value||!/^[a-f0-9]{64}$/i.test(value))throw new ApiError('El almacén privado de conexiones todavía no está habilitado en el servidor.',503);
 return Buffer.from(value,'hex');
}
function binding(scope:Bound){return Buffer.from(JSON.stringify([scope.workspace_id,scope.project_id,scope.provider,Object.entries(scope.config).sort(([a],[b])=>a.localeCompare(b))]));}
export function sealSecrets(scope:Bound,secrets:Record<string,string>,master?:string){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(master),iv);cipher.setAAD(binding(scope));
 const encrypted=Buffer.concat([cipher.update(JSON.stringify(secrets),'utf8'),cipher.final()]);
 return ['v1',iv.toString('base64'),cipher.getAuthTag().toString('base64'),encrypted.toString('base64')].join('.');
}
export function openSecrets(scope:Bound,envelope:string,master?:string):Record<string,string>{
 const secretKey=key(master);
 try{
  const parts=envelope.split('.');if(parts.length!==4||parts[0]!=='v1'||parts.slice(1).some(v=>! /^[A-Za-z0-9+/]+={0,2}$/.test(v)))throw new Error();
  const iv=Buffer.from(parts[1],'base64'),tag=Buffer.from(parts[2],'base64');if(iv.length!==12||tag.length!==16)throw new Error();
  const cipher=createDecipheriv('aes-256-gcm',secretKey,iv);cipher.setAAD(binding(scope));cipher.setAuthTag(tag);
  const raw=JSON.parse(Buffer.concat([cipher.update(Buffer.from(parts[3],'base64')),cipher.final()]).toString('utf8'));
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.values(raw).some(value=>typeof value!=='string'))throw new Error();
  return raw;
 }catch{throw new ApiError('No se pudo abrir la conexión privada. El superadministrador debe revisar su configuración.',503);}
}
