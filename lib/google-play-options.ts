export const playAssets={short_description:'Descripción breve',full_description:'Descripción completa',icon:'Icono',feature_graphic:'Gráfico destacado',screenshots:'Capturas de pantalla'} as const;
export const playMetrics={install_clicks:'Clics de instalación de usuarios únicos',open_clicks:'Clics de apertura de usuarios únicos',preregistration_clicks:'Clics de registro previo de usuarios únicos'} as const;
export type GooglePlayOptions={type:'graphics'|'localized'|null;language:string|null;asset:keyof typeof playAssets|null;metric:keyof typeof playMetrics|null;audience:number|null};
export const emptyGooglePlay=():GooglePlayOptions=>({type:null,language:null,asset:null,metric:null,audience:null});
export const googlePlaySchema={type:'object',additionalProperties:false,required:['type','language','asset','metric','audience'],properties:{type:{type:['string','null'],enum:['graphics','localized',null]},language:{type:['string','null']},asset:{type:['string','null'],enum:[...Object.keys(playAssets),null]},metric:{type:['string','null'],enum:[...Object.keys(playMetrics),null]},audience:{type:['number','null']}}};
export function parseGooglePlay(value:unknown):GooglePlayOptions|null{
 if(value===null)return null;
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Revisa la configuración de Google Play.');
 const p=value as GooglePlayOptions;
 if(p.type!==null&&!['graphics','localized'].includes(p.type))throw new Error('Selecciona el tipo de experimento de Google Play.');
 if(p.language!==null&&(typeof p.language!=='string'||!/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,3}$/.test(p.language)))throw new Error('Introduce un idioma como es-ES o en-US.');
 if(p.asset!==null&&!Object.hasOwn(playAssets,p.asset))throw new Error('Selecciona el material de Google Play.');
 if(p.metric!==null&&!Object.hasOwn(playMetrics,p.metric))throw new Error('Selecciona la métrica de Google Play.');
 if(p.audience!==null&&(typeof p.audience!=='number'||!Number.isFinite(p.audience)||p.audience<=0||p.audience>=100))throw new Error('La audiencia experimental debe ser mayor que 0 y menor que 100; conserva tráfico para el control.');
 if(p.type==='graphics'&&['short_description','full_description'].includes(p.asset||''))throw new Error('Las descripciones necesitan un experimento localizado.');
 return {type:p.type,language:p.language,asset:p.asset,metric:p.metric,audience:p.audience};
}
