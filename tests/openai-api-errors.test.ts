import test from "node:test";
import assert from "node:assert/strict";
import {openAIResponseError} from "../lib/openai-api-errors";

const response=(status:number,code?:string,type?:string)=>new Response(JSON.stringify({
 error:{code,type,message:"SECRET provider details sk-never-expose"}
}),{status,headers:{"content-type":"application/json","x-request-id":"req_diagnostic_123"}});

const cases:[
 number,string|undefined,string|undefined,RegExp,number
][]=[
 [401,"invalid_api_key","invalid_request_error",/clave.*no es válida/i,503],
 [403,"access_denied","invalid_request_error",/permisos/i,503],
 [429,"project_spend_limit_exceeded","insufficient_quota",/proyecto.*límite.*gasto/i,503],
 [429,"organization_spend_limit_exceeded","insufficient_quota",/organización.*límite.*gasto/i,503],
 [429,"organization_usage_limit_exceeded","insufficient_quota",/organización.*límite.*uso/i,503],
 [429,"credit_balance_exhausted","insufficient_quota",/créditos prepagados/i,503],
 [429,undefined,"insufficient_quota",/cuota disponible/i,503],
 [429,"rate_limit_exceeded","rate_limit_error",/ritmo de solicitudes/i,429],
 [404,"model_not_found","invalid_request_error",/modelo.*no está disponible/i,503],
 [503,"server_error","server_error",/fallo temporal/i,502],
 [400,"invalid_request_error","invalid_request_error",/rechazó la solicitud/i,502],
];

for(const [status,code,type,message,expectedStatus] of cases){
 test(`OpenAI ${status} ${code||type} translates to actionable safe diagnosis`,async()=>{
  const oldWarn=console.warn,diagnostics:unknown[][]=[];
  console.warn=(...args:unknown[])=>{diagnostics.push(args);};
  try{
   const err=await openAIResponseError(response(status,code,type),"chat");
   assert.equal(err.status,expectedStatus);
   assert.match(err.message,message);
   assert.doesNotMatch(err.message,/SECRET|sk-never-expose/);
   assert.equal(diagnostics.length,1);
   const serialized=JSON.stringify(diagnostics);
   assert.doesNotMatch(serialized,/SECRET|sk-never-expose/);
   assert.match(serialized,/req_diagnostic_123/);
  }finally{console.warn=oldWarn;}
 });
}

test("Non-JSON upstream errors are reported safely",async()=>{
 const oldWarn=console.warn;console.warn=()=>{};
 try{
  const err=await openAIResponseError(new Response("<html>secrets</html>",{status:502}),"prepare");
  assert.equal(err.status,502);assert.match(err.message,/fallo temporal/);assert.doesNotMatch(err.message,/secrets/);
 }finally{console.warn=oldWarn;}
});

test("All three AI API endpoints use shared billing and quota diagnostics",async()=>{
 const {readFile}=await import("node:fs/promises");
 for(const [file,operation] of [["chat","chat"],["prepare","prepare"],["transcribe","transcribe"]]){
  const src=await readFile(new URL(`../app/api/ai/${file}/route.ts`,import.meta.url),"utf8");
  assert.match(src,/import \{openAIResponseError\} from '@\/lib\/openai-api-errors'/);
  assert.ok(src.includes(`throw await openAIResponseError(response,"${operation}")`));
 }
});
