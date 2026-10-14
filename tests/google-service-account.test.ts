import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,verify} from 'node:crypto';
import {googleServiceAssertion} from '../lib/google-service-account';
import {googleAccessToken} from '../lib/google-ads';
import {validateIntegration} from '../lib/integrations';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const raw=JSON.stringify({type:'service_account',project_id:'customer',client_email:'experiments@customer.iam.gserviceaccount.com',private_key_id:'unit-key',private_key:privateKey.export({format:'pem',type:'pkcs8'}),token_uri:'https://evil.invalid/token',sub:'owner@customer.example',scope:'unapproved-scope'});
test('service account JWT uses verified RSA signature, adwords-only scope, a fixed audience and one-hour expiry without impersonation',()=>{
 const assertion=googleServiceAssertion(raw,1800000000000),[header,payload,signature]=assertion.split('.');
 assert.deepEqual(JSON.parse(Buffer.from(header,'base64url').toString()),{alg:'RS256',typ:'JWT',kid:'unit-key'});
 assert.deepEqual(JSON.parse(Buffer.from(payload,'base64url').toString()),{iss:'experiments@customer.iam.gserviceaccount.com',scope:'https://www.googleapis.com/auth/adwords',aud:'https://oauth2.googleapis.com/token',iat:1800000000,exp:1800003600});
 assert.equal(verify('RSA-SHA256',Buffer.from(`${header}.${payload}`),publicKey,Buffer.from(signature,'base64url')),true);
 assert.throws(()=>googleServiceAssertion('malformed-private-data'),error=>error instanceof Error&&!error.message.includes('malformed-private-data'));
});
test('private account JSON replaces OAuth credentials, and token exchange never uses destinations from the key file',async()=>{
 const saved=validateIntegration('google_ads',{customer_id:'123-456-7890',auth_method:'service_account',client_id:'old-client'},{service_account:raw,client_secret:'old-secret',refresh_token:'old-refresh'});
 assert.equal(saved.config.customer_id,'1234567890');assert.equal(saved.config.client_id,undefined);assert.deepEqual(Object.keys(saved.secrets),['service_account']);
 const token=await googleAccessToken({customerId:saved.config.customer_id,serviceAccount:saved.secrets.service_account},(async(input,init)=>{
  assert.equal(String(input),'https://oauth2.googleapis.com/token');assert.equal(init?.redirect,'error');
  const body=init?.body as URLSearchParams;assert.equal(body.get('grant_type'),'urn:ietf:params:oauth:grant-type:jwt-bearer');assert.equal(body.has('refresh_token'),false);assert.equal(body.has('private_key'),false);
  return Response.json({access_token:'api-access',token_type:'Bearer'});
 }) as typeof fetch);
 assert.equal(token,'api-access');
 assert.throws(()=>validateIntegration('google_ads',{customer_id:'1234567890',auth_method:'service_account'},{}),/JSON/);
 assert.throws(()=>validateIntegration('google_ads',{customer_id:'1234567890',auth_method:'invalid'},{service_account:raw}),/Elige/);
 assert.throws(()=>validateIntegration('google_ads',{customer_id:'1234567890'},{}),/OAuth/);
 await assert.rejects(googleAccessToken({customerId:'1234567890',serviceAccount:raw},(async()=>Response.json({error:'private-provider-details'},{status:400})) as typeof fetch),error=>error instanceof Error&&!error.message.includes('private-provider-details'));
});
