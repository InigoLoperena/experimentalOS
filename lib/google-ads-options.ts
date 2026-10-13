export type GoogleAdsOptions={type:'SEARCH';countries:string[];language_ids:string[];keywords:string[];match_type:'PHRASE'|'EXACT';cpc_limit:number|null;eu_political:boolean|null};
export function emptyGoogleAds():GoogleAdsOptions{return {type:'SEARCH',countries:[],language_ids:[],keywords:[],match_type:'PHRASE',cpc_limit:null,eu_political:null};}
export const googleAdsOptionsSchema={type:'object',additionalProperties:false,required:['type','countries','language_ids','keywords','match_type','cpc_limit','eu_political'],properties:{type:{type:'string',enum:['SEARCH']},countries:{type:'array',items:{type:'string'}},language_ids:{type:'array',items:{type:'string'}},keywords:{type:'array',items:{type:'string'}},match_type:{type:'string',enum:['PHRASE','EXACT']},cpc_limit:{type:['number','null']},eu_political:{type:['boolean','null']}}};
export function parseGoogleAdsOptions(raw:unknown):GoogleAdsOptions|null{
 if(raw==null)return null;
 const v=raw as GoogleAdsOptions;
 if(typeof v!=='object'||Array.isArray(v)||v.type!=='SEARCH'||!['PHRASE','EXACT'].includes(v.match_type))throw new Error('Revisa el tipo de campaña de Google Ads.');
 const list=(value:unknown,max:number,check:(s:string)=>boolean)=>{if(!Array.isArray(value)||value.length>max||value.some(s=>typeof s!=='string'||!check(s))||new Set(value).size!==value.length)throw new Error('Revisa países, idiomas y palabras clave de Google Ads.');return value as string[];};
 if(v.cpc_limit!==null&&(typeof v.cpc_limit!=='number'||!Number.isFinite(v.cpc_limit)||v.cpc_limit<=0||v.cpc_limit>10000))throw new Error('Revisa el límite de CPC de Google Ads.');
 if(v.eu_political!==null&&typeof v.eu_political!=='boolean')throw new Error('Confirma la declaración de publicidad política.');
 return {type:'SEARCH',countries:list(v.countries,10,s=>/^[A-Z]{2}$/.test(s)),language_ids:list(v.language_ids,10,s=>/^\d{1,10}$/.test(s)),keywords:list(v.keywords,50,s=>s===s.trim()&&s.length>0&&s.length<=80&&!/[\r\n\x00]/.test(s)),match_type:v.match_type,cpc_limit:v.cpc_limit,eu_political:v.eu_political};
}
