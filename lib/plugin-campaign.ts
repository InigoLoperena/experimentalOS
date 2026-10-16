import { executionSchema, parseExecution, type ExecutionPlan } from './execution-plan';

export const pluginCampaignProviders = { google_ads: 'Google Ads', meta_ads: 'Meta Ads · Facebook e Instagram', smartlead: 'Smartlead' } as const;
export type PluginCampaign = { provider: keyof typeof pluginCampaignProviders; plan: ExecutionPlan };
export const pluginCampaignSchema = {
  type: 'object', additionalProperties: false, required: ['provider', 'plan'],
  properties: { provider: { type: 'string', enum: Object.keys(pluginCampaignProviders) }, plan: executionSchema },
};
function known(value: unknown, keys: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !keys.includes(k))) throw new Error('La campaña contiene campos no admitidos. No incluyas credenciales ni identificadores de cuenta.');
}
export function parsePluginCampaign(raw: unknown): PluginCampaign {
  known(raw, ['provider', 'plan']);
  const value = raw as PluginCampaign;
  if (!Object.hasOwn(pluginCampaignProviders, value.provider)) throw new Error('Esta conexión admite Google Ads, Meta Ads y Smartlead.');
  known(value.plan, Object.keys(executionSchema.properties));
  if (Array.isArray(value.plan.variants)) for (const v of value.plan.variants) known(v, Object.keys(executionSchema.properties.variants.items.properties));
  if (value.plan.play != null || value.plan.posthog != null) throw new Error('No mezcles la configuración de otros canales en esta campaña.');
  if (value.plan.google != null) known(value.plan.google, ['type','countries','language_ids','keywords','match_type','cpc_limit','eu_political','business_name','long_headlines']);
  if (value.plan.meta != null) known(value.plan.meta, ['objective','countries','city_key','age_min','age_max','placements','conversion_event']);
  const plan = parseExecution(value.plan);
  if (plan.variants.length !== 2 || plan.variants.some(v => !v.headline?.trim() || !v.body?.trim())) throw new Error('Prepara dos variantes con sus titulares o asuntos y sus textos.');
  if (value.provider !== 'smartlead' && (!plan.destination || !plan.currency || !plan.daily_budget)) throw new Error('Indica el destino HTTPS, la moneda y un presupuesto diario positivo.');
  if (value.provider === 'google_ads') {
    if (!plan.google || !['SEARCH','DISPLAY'].includes(plan.google.type) || plan.meta != null) throw new Error('Esta preparación admite campañas de Búsqueda o Display de Google Ads.');
    if (!plan.google.countries.length || !plan.google.language_ids.length || !plan.google.cpc_limit || (plan.google.type === 'SEARCH' && !plan.google.keywords.length)) throw new Error('Google necesita países, idiomas, CPC máximo y, para Búsqueda, palabras clave.');
    for (const v of plan.variants) {
      const headlines = v.headline!.split('\n').map(s => s.trim()).filter(Boolean), descriptions = v.body!.split('\n').map(s => s.trim()).filter(Boolean);
      if (headlines.length < (plan.google.type === 'SEARCH' ? 3 : 1) || headlines.length > (plan.google.type === 'SEARCH' ? 15 : 5) || headlines.some(s => Array.from(s).length > 30) || new Set(headlines.map(s => s.toLowerCase())).size !== headlines.length) throw new Error('Google: cada variante necesita titulares distintos de hasta 30 caracteres; Búsqueda requiere al menos tres por variante.');
      if (descriptions.length < (plan.google.type === 'SEARCH' ? 2 : 1) || descriptions.length > (plan.google.type === 'SEARCH' ? 4 : 5) || descriptions.some(s => Array.from(s).length > 90) || new Set(descriptions.map(s => s.toLowerCase())).size !== descriptions.length) throw new Error('Google: cada variante necesita descripciones distintas de hasta 90 caracteres; Búsqueda requiere al menos dos por variante.');
    }
    if (plan.google.type === 'DISPLAY' && (!plan.google.business_name?.trim() || plan.google.long_headlines?.length !== 2)) throw new Error('Google Display necesita la marca y un titular largo para cada variante.');
  } else if (value.provider === 'meta_ads') {
    if (!plan.meta || plan.google != null) throw new Error('Incluye la configuración de Meta Ads, sin mezclar Google.');
    if (!plan.meta.objective || !plan.meta.countries.length) throw new Error('Meta necesita objetivo y países de destino.');
  } else {
    if (plan.meta != null || plan.google != null) throw new Error('No mezcles publicidad de Google o Meta con el correo de Smartlead.');
    if (plan.variants.some(v => v.allocation !== 50) || (plan.variants[0].headline === plan.variants[1].headline && plan.variants[0].body === plan.variants[1].body)) throw new Error('Smartlead necesita dos correos distintos con reparto 50/50.');
    if (plan.variants.some(v => v.headline!.length > 200 || /[\r\n]/.test(v.headline!))) throw new Error('Cada asunto de Smartlead debe ocupar una línea de hasta 200 caracteres.');
  }
  return { provider: value.provider, plan };
}
