import type { Metadata } from 'next';

export const pluginPath = '/plugins/validacion-de-negocios';
export const pluginEmail = 'hello@xperiments.site';
export const pluginEditor = 'Iñigo Loperena';
export const pluginAddress = 'Obispo Lascano 2438, CP 5000, Córdoba, Argentina';
export const pluginUpdated = '16 de octubre de 2026';
export const pluginPages = [
  { path: pluginPath, label: 'Presentación' },
  { path: `${pluginPath}/soporte`, label: 'Soporte' },
  { path: `${pluginPath}/privacidad`, label: 'Privacidad' },
  { path: `${pluginPath}/terminos`, label: 'Términos' },
] as const;

export function pluginMetadata(title: string, description: string, path: string): Metadata {
  const url = `https://xperiments.site${path}`;
  return {
    title: `${title} · Validación de negocios`, description,
    alternates: { canonical: url },
    openGraph: { title: `${title} · Validación de negocios`, description, url, locale: 'es_AR', type: 'website' },
  };
}

export function supportMailto(subject: string) {
  return `mailto:${pluginEmail}?subject=${encodeURIComponent(subject)}`;
}
