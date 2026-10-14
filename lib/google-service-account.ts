import {createPrivateKey,sign} from 'node:crypto';
import {ApiError} from './server-access';
export function googleServiceAssertion(raw:string,now=Date.now()){
 try{
  const row=JSON.parse(raw);
  if(row?.type!=='service_account'||typeof row.client_email!=='string'||!/^[-a-z0-9_.]+@[-a-z0-9.]+\.gserviceaccount\.com$/i.test(row.client_email)||typeof row.private_key!=='string')throw new Error();
  const key=createPrivateKey(row.private_key);if(key.asymmetricKeyType!=='rsa')throw new Error();
  const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const issued=Math.floor(now/1000);
  const header={alg:'RS256',typ:'JWT',...(typeof row.private_key_id==='string'&&/^[a-zA-Z0-9_-]{1,200}$/.test(row.private_key_id)?{kid:row.private_key_id}:{})};
  // Never use URLs, scopes or impersonation subjects from an uploaded key file.
  const claims={iss:row.client_email,scope:'https://www.googleapis.com/auth/adwords',aud:'https://oauth2.googleapis.com/token',iat:issued,exp:issued+3600};
  const input=`${encode(header)}.${encode(claims)}`;
  return `${input}.${sign('RSA-SHA256',Buffer.from(input),key).toString('base64url')}`;
 }catch{throw new ApiError('El JSON no contiene una cuenta de servicio de Google con una clave RSA válida. Descárgalo desde Google Cloud y guárdalo en Integraciones.',400);}
}
