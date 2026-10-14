import type {Connection,IntegrationProvider,IntegrationField} from './integrations';
export type IntegrationProfile={workspace_id:string;project_id:string;provider:IntegrationProvider;connection_id:string;config:Record<string,string>;updated_at:string};
export function workspaceConnectionChoice(rows:Connection[],provider:IntegrationProvider){
 const candidates=rows.filter(row=>row.provider===provider);
 return candidates.find(row=>row.workspace_default)||candidates.find(row=>row.project_id===null)||(candidates.length===1?candidates[0]:null)||null;
}
export const integrationProfileFields:Partial<Record<IntegrationProvider,IntegrationField[]>>={
 metricool:[{key:'blog_id',label:'Marca de Metricool',format:'number',required:true}],
 posthog:[{key:'project_id',label:'Proyecto de PostHog',format:'number',required:true},{key:'host',label:'Región de PostHog',format:'host',required:true}],
 meta_ads:[{key:'pixel_id',label:'Píxel de este proyecto',format:'number',required:true}],
 app_store:[{key:'app_id',label:'App de App Store Connect',format:'number',required:true}],
 google_play:[{key:'package_name',label:'Paquete de la app Android',required:true}],
};
