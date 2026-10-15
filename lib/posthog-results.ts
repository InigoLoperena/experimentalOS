export function posthogResultVariants(value:any):{name:string;value:unknown;exposures:unknown}[]{
 // New PostHog releases return cached per-metric calculations; older ones return variants directly.
 const metric=value?.results?.find((row:any)=>row?.result?.variants)?.result||value;
 const candidates=[metric?.variants,metric?.variant_results,metric?.results,metric?.metrics?.[0]?.variants,metric?.primary_metrics?.[0]?.variants];
 const source=candidates.find(Array.isArray)||[];
 const rows=metric?.baseline&&!source.some((r:any)=>(r?.key||r?.variant)===(metric.baseline.key||'control'))?[{key:'control',...metric.baseline},...source]:source;
 return rows.slice(0,8).map((row:any,i:number)=>({name:String(row?.key||row?.name||row?.variant||row?.label||`Variante ${i+1}`),value:row?.conversion_rate??row?.conversionRate??row?.mean??row?.value??row?.count,exposures:row?.exposures??row?.number_of_samples??row?.sample_size??row?.sampleSize??row?.participants}));
}
