export const posthogChannels=['posthog','web_app','mobile_ios','mobile_android'];
export type PosthogOptions={metric_event:string|null;metric_type:'funnel'|'mean'|null;rollout_percentage:number|null;window_days:number|null};
export const posthogOptionsSchema={type:'object',additionalProperties:false,required:['metric_event','metric_type','rollout_percentage','window_days'],properties:{metric_event:{type:['string','null'],maxLength:200},metric_type:{type:['string','null'],enum:['funnel','mean',null]},rollout_percentage:{type:['integer','null'],minimum:0,maximum:100},window_days:{type:['integer','null'],minimum:1,maximum:90}}};
export function parsePosthogOptions(value:unknown):PosthogOptions|null{
 if(value==null)return null;
 if(typeof value!=='object'||Array.isArray(value))throw new Error('Revisa la preparación de PostHog.');
 const v=value as PosthogOptions;
 if(v.metric_event!==null&&(typeof v.metric_event!=='string'||v.metric_event.length>200))throw new Error('Revisa el evento de PostHog.');
 if(v.metric_type!==null&&!['funnel','mean'].includes(v.metric_type))throw new Error('Revisa la métrica de PostHog.');
 for(const [key,max] of [['rollout_percentage',100],['window_days',90]] as const)if(v[key]!==null&&(!Number.isInteger(v[key])||v[key]!<(key==='rollout_percentage'?0:1)||v[key]!>max))throw new Error('Revisa el porcentaje y la ventana de PostHog.');
 return {metric_event:v.metric_event?.trim()||null,metric_type:v.metric_type,rollout_percentage:v.rollout_percentage,window_days:v.window_days};
}
