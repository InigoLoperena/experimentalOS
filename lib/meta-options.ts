export const metaObjectives = {traffic:'Tráfico a una web',awareness:'Reconocimiento y alcance',leads:'Leads en una web',sales:'Ventas en una web',engagement:'Interacciones con el anuncio'} as const;
export const metaPlacements = {feed:'Feed · Facebook e Instagram',story:'Stories · Facebook e Instagram',reels:'Reels · Facebook e Instagram'} as const;
export const metaFormats = {feed:{width:1440,height:1800,label:'Feed · 4:5'},story:{width:1440,height:2560,label:'Stories · 9:16'},reels:{width:1440,height:2560,label:'Reels · 9:16'}} as const;
export const metaEvents = ['LEAD','COMPLETE_REGISTRATION','PURCHASE','ADD_TO_CART','INITIATE_CHECKOUT','VIEW_CONTENT'] as const;
export type MetaOptions={objective:keyof typeof metaObjectives|null;countries:string[];city_key:string|null;age_min:number|null;age_max:number|null;placements:(keyof typeof metaPlacements)[];conversion_event:typeof metaEvents[number]|null};
export const emptyMeta=():MetaOptions=>({objective:null,countries:[],city_key:null,age_min:null,age_max:null,placements:[],conversion_event:null});
export const metaOptionsSchema={type:'object',additionalProperties:false,required:['objective','countries','city_key','age_min','age_max','placements','conversion_event'],properties:{objective:{type:['string','null'],enum:[...Object.keys(metaObjectives),null]},countries:{type:'array',items:{type:'string'}},city_key:{type:'null'},age_min:{type:['integer','null']},age_max:{type:['integer','null']},placements:{type:'array',items:{type:'string',enum:Object.keys(metaPlacements)}},conversion_event:{type:['string','null'],enum:[...metaEvents,null]}}};
export function parseMetaOptions(value:unknown):MetaOptions|null{
 if(value==null)return null;
 if(typeof value!=='object'||Array.isArray(value))throw new Error('Revisa la configuración de Meta.');
 const v=value as MetaOptions;
 const age=(n:unknown)=>n===null?null:typeof n==='number'&&Number.isInteger(n)&&n>=18&&n<=65?n:(()=>{throw new Error('Selecciona edades entre 18 y 65 (65 incluye mayores).');})();
 if(v.objective!==null&&!Object.hasOwn(metaObjectives,v.objective))throw new Error('Objetivo de Meta no válido.');
 if(!Array.isArray(v.countries)||v.countries.length>10||v.countries.some(c=>typeof c!=='string'||! /^[A-Z]{2}$/.test(c)))throw new Error('Usa códigos de país de dos letras.');
 if(!Array.isArray(v.placements)||v.placements.length>3||v.placements.some(p=>!Object.hasOwn(metaPlacements,p)))throw new Error('Selecciona ubicaciones de Meta válidas.');
 if(v.city_key!==null&&(typeof v.city_key!=='string'||! /^\d{1,30}$/.test(v.city_key)))throw new Error('Selecciona la ciudad mediante la búsqueda de Meta.');
 if(v.conversion_event!==null&&!metaEvents.includes(v.conversion_event))throw new Error('Selecciona un evento de conversión válido.');
 const min=age(v.age_min),max=age(v.age_max);if(min!==null&&max!==null&&min>max)throw new Error('Revisa el rango de edad.');
 return {objective:v.objective,countries:[...new Set(v.countries)],city_key:v.city_key,age_min:min,age_max:max,placements:[...new Set(v.placements)],conversion_event:v.conversion_event};
}
