/** Public product facts only. Never derive marketing copy from workspace records. */
export const productDefinition = 'Xperiments es un espacio de trabajo para equipos y emprendedores que quieren validar su propuesta de valor y modelo de negocio. Conecta problemas, hipótesis, experimentos, resultados y aprendizajes, con una IA que utiliza el contexto del equipo para ayudarte a decidir qué probar después.';

export const productCapabilities = [
 { title: 'De un problema a una prueba concreta', description: 'Organiza proyectos, problemas e hipótesis. Relaciona cada experimento con la pregunta que quieres responder y define cómo reconocerás una señal útil.', icon: 'hypothesis' },
 { title: 'Prepara experimentos con IA', description: 'Describe tu idea, adjunta materiales y revisa la propuesta de la IA. Utiliza el mismo contexto para preparar la ficha y los recursos de las herramientas conectadas.', icon: 'ai' },
 { title: 'Resultados que no se pierden', description: 'Asocia recursos externos, incorpora métricas y documenta qué aprendiste. Conserva la fuente y los límites de cada conclusión antes de reutilizarla.', icon: 'learning' },
] as const;

export const productSteps = [
 { number: '01', title: 'Encuentra la pregunta', text: 'Reúne contexto, investigación y problemas. Distingue lo que observaste de lo que todavía supones.' },
 { number: '02', title: 'Diseña el experimento', text: 'Define una hipótesis, un público, una métrica principal y un criterio de éxito. La IA te ayuda a preparar la prueba.' },
 { number: '03', title: 'Prepara, revisa y ejecuta', text: 'Conecta la herramienta que utilizas. Revisa sus recursos y publica manualmente cuando corresponda.' },
 { number: '04', title: 'Convierte resultados en aprendizaje', text: 'Compara la evidencia con tu hipótesis, documenta las limitaciones y decide qué merece la siguiente prueba.' },
] as const;

export const productFaqs = [
 { question: '¿Qué es Xperiments?', answer: productDefinition },
 { question: '¿Para quién está pensado?', answer: 'Para emprendedores, equipos de producto y growth que necesitan investigar problemas, contrastar hipótesis y organizar experimentos de negocio. Es útil tanto para preparar una primera validación como para conservar lo aprendido en varios proyectos de un equipo.' },
 { question: '¿Qué hace la IA con mis experimentos?', answer: 'Recupera contexto autorizado del espacio de trabajo, como proyectos, hipótesis, experimentos y aprendizajes. Lo combina, cuando resulta útil, con conocimiento metodológico compartido para proponer pruebas y ayudar a interpretar resultados. Las propuestas de la IA requieren revisión; una hipótesis no se convierte automáticamente en un hecho.' },
 { question: '¿Puedo preparar campañas desde un prompt?', answer: 'Puedes describir un experimento y adjuntar materiales para preparar su ficha. En las integraciones compatibles, Xperiments puede crear recursos externos para revisión. Las operaciones disponibles dependen de la API, los permisos y la configuración de cada cuenta. La activación de campañas publicitarias sigue siendo manual.' },
 { question: '¿Reemplaza a Meta Ads, Google Ads o PostHog?', answer: 'No. Xperiments organiza la experimentación y conecta herramientas externas. Las cuentas, la publicación y sus controles propios siguen en cada plataforma. No es un motor universal de entrega de anuncios, feature flags ni cálculo estadístico sobre un data warehouse.' },
 { question: '¿La IA comparte los datos de mi equipo con otros clientes?', answer: 'La memoria de cada espacio de trabajo se mantiene separada mediante controles de acceso. La biblioteca metodológica general se comparte; tus proyectos, conversaciones y documentos no se incorporan a esa biblioteca. Las funciones de IA envían al proveedor el contexto necesario para la solicitud, según la política de privacidad.' },
 { question: '¿Cómo puedo acceder?', answer: 'Xperiments se encuentra en un piloto privado. Si ya tienes una cuenta, accede a tu espacio. Para consultar disponibilidad o solicitar acceso, escribe a hello@xperiments.site. No hay planes comerciales ni precios publicados en esta página.' },
] as const;

export function publicProductMarkdown() {
 return `# Xperiments — experimentación de negocio con IA\n\n${productDefinition}\n\n## Cómo funciona\n\n${productSteps.map(step=>`### ${step.title}\n\n${step.text}`).join('\n\n')}\n\n## Preguntas frecuentes\n\n${productFaqs.map(faq=>`### ${faq.question}\n\n${faq.answer}`).join('\n\n')}\n\n## Acceso y documentación\n\n- Sitio oficial: https://www.xperiments.site/\n- Aplicación: https://www.xperiments.site/proyectos\n- Blog: https://www.xperiments.site/blog\n- Guía de investigación: https://www.xperiments.site/guia-investigacion\n- Información para agentes: https://www.xperiments.site/agentes\n- Privacidad: https://www.xperiments.site/privacy-policy\n- Contacto: hello@xperiments.site\n\nEste documento describe el producto. No contiene información de los espacios de trabajo.\n`;
}
