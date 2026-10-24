import { SITE_URL } from '@/lib/public-site';

export const dynamic = 'force-static';

export function GET() {
  return new Response(`# Xperiments

> Una herramienta en español para organizar hipótesis, diseñar experimentos de negocio con IA y documentar resultados y aprendizajes.

Los proyectos se organizan en espacios de trabajo privados. La IA combina contexto autorizado del equipo con conocimientos metodológicos compartidos. Ayuda a preparar fichas y propuestas para herramientas conectadas; las campañas requieren revisión y publicación manual. Las hipótesis y recomendaciones no son resultados demostrados.

## Documentación pública
- [Presentación](${SITE_URL}/): propuesta de valor y funcionamiento de Xperiments.
- [Blog](${SITE_URL}/blog): artículos publicados; no incluye borradores editoriales.
- [Información para agentes](${SITE_URL}/agentes): capacidades reales, límites y acceso a documentación pública.
- [Descripción del producto en Markdown](${SITE_URL}/producto.md): alternativa textual de la presentación pública.
- [Guía de investigación](${SITE_URL}/guia-investigacion): reunir evidencias y contexto para formular hipótesis y experimentos.
- [Privacidad de la web y aplicación](${SITE_URL}/privacy-policy): tratamiento de datos y servicios conectados.

## Complemento Validación de negocios
- [Presentación](${SITE_URL}/plugins/validacion-de-negocios)
- [Soporte](${SITE_URL}/plugins/validacion-de-negocios/soporte)
- [Privacidad del complemento](${SITE_URL}/plugins/validacion-de-negocios/privacidad)
- [Términos del complemento](${SITE_URL}/plugins/validacion-de-negocios/terminos)

## Acceso
Estas páginas públicas se pueden leer sin iniciar sesión. Los proyectos, archivos, conversaciones y resultados de los espacios de trabajo requieren autenticación y permisos. Este archivo describe contenido público: no concede acceso a datos privados ni autoriza acciones en cuentas externas.

Índice de URLs: ${SITE_URL}/sitemap.xml
Artículos publicados en RSS: ${SITE_URL}/feed.xml
`, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' } });
}
