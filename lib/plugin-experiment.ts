/** The public tool accepts only draft content, never account IDs or credentials. */
export type PluginExperiment = {
  title: string; context: string; hypothesis: string; metric: string;
  success_criteria: string; start?: string; tags?: string;
  impact?: number; confidence?: number; ease?: number;
};
export const pluginExperimentSchema = {
  type: 'object', additionalProperties: false,
  required: ['title', 'context', 'hypothesis', 'metric', 'success_criteria'],
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 160 },
    context: { type: 'string', minLength: 1, maxLength: 2000 },
    hypothesis: { type: 'string', minLength: 1, maxLength: 2000 },
    metric: { type: 'string', minLength: 1, maxLength: 240 },
    success_criteria: { type: 'string', minLength: 1, maxLength: 1200 },
    start: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    tags: { type: 'string', maxLength: 200 },
    impact: { type: 'integer', minimum: 1, maximum: 10 },
    confidence: { type: 'integer', minimum: 1, maximum: 10 },
    ease: { type: 'integer', minimum: 1, maximum: 10 },
  },
} as const;

export function parsePluginExperiment(input: unknown): PluginExperiment {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Revisa la ficha del experimento.');
  const raw = input as Record<string, unknown>;
  const props = pluginExperimentSchema.properties;
  if (Object.keys(raw).some(k => !Object.hasOwn(props, k))) throw new Error('La ficha contiene campos no admitidos.');
  const result: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(props)) {
    const value = raw[key];
    if (value === undefined && !(pluginExperimentSchema.required as readonly string[]).includes(key)) continue;
    if (schema.type === 'integer') {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 10) throw new Error('Las puntuaciones deben ser enteros entre 1 y 10.');
      result[key] = value;
    } else {
      if (typeof value !== 'string' || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new Error(`Revisa el campo ${key}.`);
      const text = value.trim();
      if (('minLength' in schema && !text) || ('maxLength' in schema && text.length > schema.maxLength)) throw new Error(`Revisa la longitud de ${key}.`);
      if (key === 'start' && (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(Date.parse(text)) || new Date(text).toISOString().slice(0, 10) !== text)) throw new Error('La fecha de inicio no es válida.');
      result[key] = text;
    }
  }
  // Keep the encrypted review link small enough for browsers and chat clients.
  if (new TextEncoder().encode(JSON.stringify(result)).length > 6500) throw new Error('Resume la ficha: el contenido completo es demasiado largo.');
  return result as PluginExperiment;
}
