// Server only: derive a separate key; never expose the integrations master key.
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes, randomUUID } from 'node:crypto';
import { parsePluginExperiment, type PluginExperiment } from './plugin-experiment';
import { ApiError } from './server-access';

const purpose = 'xperiments:chatgpt-review-draft:v1';
const ttl = 30 * 60 * 1000;
export type PluginDraft = { id: string; issued_at: number; expires_at: number; experiment: PluginExperiment };
function draftKey(master = process.env.MCP_DRAFT_ENCRYPTION_KEY) {
  if (!master || !/^[a-f0-9]{64}$/i.test(master)) throw new ApiError('La conexión del complemento todavía no está configurada.', 503);
  return Buffer.from(hkdfSync('sha256', Buffer.from(master, 'hex'), purpose, 'draft-link', 32));
}
export function sealPluginDraft(input: unknown, now = Date.now(), master?: string) {
  const experiment = parsePluginExperiment(input);
  const draft: PluginDraft = { id: randomUUID(), issued_at: now, expires_at: now + ttl, experiment };
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', draftKey(master), iv);
  cipher.setAAD(Buffer.from(purpose));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(draft), 'utf8'), cipher.final()]);
  return { token: ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.'), expires_at: new Date(draft.expires_at).toISOString() };
}
export function openPluginDraft(token: unknown, now = Date.now(), master?: string): PluginDraft {
  const key = draftKey(master);
  try {
    if (typeof token !== 'string' || token.length > 10000 || !/^v1\.[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) throw new Error();
    const [, rawIv, rawTag, rawContent] = token.split('.');
    const iv = Buffer.from(rawIv, 'base64url'), tag = Buffer.from(rawTag, 'base64url');
    if (iv.length !== 12 || tag.length !== 16) throw new Error();
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(Buffer.from(purpose)); decipher.setAuthTag(tag);
    const draft = JSON.parse(Buffer.concat([decipher.update(Buffer.from(rawContent, 'base64url')), decipher.final()]).toString('utf8')) as PluginDraft;
    if (!/^[0-9a-f-]{36}$/.test(draft.id) || !Number.isFinite(draft.issued_at) || !Number.isFinite(draft.expires_at) || draft.issued_at > now + 60000 || draft.expires_at <= now || draft.expires_at - draft.issued_at !== ttl) throw new Error();
    return { ...draft, experiment: parsePluginExperiment(draft.experiment) };
  } catch { throw new ApiError('El enlace no es válido o ha caducado. Pide uno nuevo al complemento.', 400); }
}
/** Same draft + account = same record, including concurrent requests/retries. */
export function pluginRecordId(draftId: string, userId: string) {
  const bytes = createHash('sha256').update(`${purpose}:${draftId}:${userId}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
