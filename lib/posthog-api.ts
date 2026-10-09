export class PostHogError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}

export function posthogIdentifier(value: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) throw new PostHogError("El identificador de PostHog no es válido.", 400);
  return encodeURIComponent(value);
}

export function posthogHost(value: string, additionalHosts = "") {
  const raw = value.trim() || "https://us.posthog.com";
  let url: URL;
  try { url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); }
  catch { throw new PostHogError("El host de PostHog no es válido.", 400); }
  const allowed = new Set(["us.posthog.com", "eu.posthog.com", "app.posthog.com",
    ...additionalHosts.split(",").map(host => host.trim().toLowerCase()).filter(Boolean)]);
  if (url.protocol !== "https:" || url.username || url.password || url.port ||
      !allowed.has(url.hostname) || !["", "/"].includes(url.pathname) || url.search || url.hash)
    throw new PostHogError("Usa el host HTTPS de PostHog US/EU o un host autorizado en el servidor.", 400);
  return url.origin;
}

export async function posthogJson(url: string, key: string, fetcher: typeof fetch = fetch) {
  const response = await fetcher(url, {
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(25000),
  });
  let payload;
  try { payload = await response.json(); }
  catch { throw new PostHogError("PostHog devolvió una respuesta no válida."); }
  if (!response.ok) throw new PostHogError(
    payload?.detail || payload?.error || "PostHog ha rechazado la consulta.", response.status);
  return payload;
}

export async function listPosthogExperiments(host: string, projectId: string, key: string, fetcher: typeof fetch = fetch) {
  const base = new URL(`${host}/api/projects/${posthogIdentifier(projectId)}/experiments/`);
  let next: string | null = `${base}?limit=100`;
  const visited = new Set<string>();
  const experiments: Record<string, unknown>[] = [];
  while (next) {
    let url: URL;
    try { url = new URL(next, base); }
    catch { throw new PostHogError("La paginación de PostHog no es válida."); }
    if (url.origin !== base.origin || url.pathname !== base.pathname || url.username || url.password || url.hash ||
        visited.has(url.href) || visited.size >= 100)
      throw new PostHogError("No se pudo descargar la lista completa de PostHog. No se sincronizaron los datos.");
    visited.add(url.href);
    const payload = await posthogJson(url.href, key, fetcher);
    const rows = Array.isArray(payload) ? payload : payload?.results;
    if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== "object" || Array.isArray(row) ||
        (row.id == null && row.pk == null && row.uuid == null)))
      throw new PostHogError("PostHog devolvió una lista no válida. No se sincronizaron los datos.");
    experiments.push(...rows);
    if (!Array.isArray(payload) && payload.next != null && typeof payload.next !== "string")
      throw new PostHogError("La paginación de PostHog no es válida.");
    next = Array.isArray(payload) ? null : payload.next || null;
  }
  return { results: experiments, next: null, count: experiments.length };
}
