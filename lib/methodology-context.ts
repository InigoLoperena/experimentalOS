import type {MemorySource} from './ai-memory';
import {methodologyBooks, methodologyVersion, type MethodologyBookId} from './methodology-library';

// Original Spanish paraphrases reviewed against the supplied PDFs, not full books or quotations.
// No workspace content is ever written into this common catalog.
type Guide = {pages: string; principles: readonly string[]};
const guides: Record<MethodologyBookId, Guide> = {
  'la-empresa-experimental': {
    pages: 'PDF 113–115 y 127–129 de La empresa experimental_compressed.pdf',
    principles: [
      'Combinar observaciones cuantitativas, investigación cualitativa y contexto de negocio para detectar una oportunidad; una explicación plausible sigue siendo una hipótesis.',
      'Conectar cada prueba con un objetivo y una oportunidad del GOI Tree y con la North Star real del proyecto. Una idea es una intervención posible, no una necesidad demostrada.',
      'Describir qué cambia, para quién, qué resultado medible se espera y qué mecanismo lo explicaría. Diseñar la prueba para poder aprender si la hipótesis no se sostiene.',
      'Definir comparación, unidad de asignación, medición principal, posibles efectos secundarios y ventana de observación. Acordar el criterio de decisión antes de interpretar los resultados; no inventar muestras, umbrales ni significancia.',
      'Distinguir una comparación de mensajes de una prueba causal aleatorizada. Evaluar sesgos de selección, diferencias de exposición y contaminación antes de atribuir un cambio a la intervención.',
      'Cerrar el ciclo registrando resultados, limitaciones, decisión y siguiente prueba. Considerar iterar, escalar, replantear o archivar según la evidencia. Conservar también aprendizajes negativos o inconclusos, con su contexto.',
    ],
  },
  'go-to-market-strategist': {
    pages: 'PDF 7–8, 18–21, 74–75, 174–175 y 212 de GTM-espanol.pdf',
    principles: [
      'Alinear mercado, cliente inicial, oferta, precio, posicionamiento y adquisición. Un plan de marketing aislado no comprueba el encaje entre producto y mercado.',
      'Escoger un segmento inicial concreto y accesible con un problema relevante. Diferenciar a quien puede adoptar y comprar ahora del cliente ideal de una empresa madura; revisar el perfil mediante investigación.',
      'Contrastar la propuesta de valor frente a las alternativas que el cliente utiliza, incluida la solución manual o seguir igual. Comunicar el resultado que obtiene el cliente y una diferencia comprensible.',
      'Comprobar por separado necesidad, comprensión de la oferta, uso que entrega valor y disposición real a pagar. El interés o una tasa de clics no demuestran compra, retención ni product-market fit.',
      'Elegir pocos canales coherentes con el segmento y las capacidades del equipo; comparar adquisición, activación, valor entregado y viabilidad económica antes de ampliar esfuerzos.',
      'Usar la North Star para seguir valor entregado al cliente, acompañada por sus entradas medibles. Tratar precio, mensaje y canal como supuestos contrastables, sin copiar porcentajes o benchmarks ilustrativos como reglas universales.',
    ],
  },
  'the-mom-test': {
    pages: 'PDF 14, 24, 37, 54–55, 73, 79–82 y 89 de The mom test.pdf (edición española escaneada)',
    principles: [
      'Investigar la vida y el trabajo del cliente antes de presentar la idea. Preguntar por episodios recientes y específicos, acciones y dificultades reales, en lugar de solicitar aprobación para la solución.',
      'Explorar cómo resolvió la última vez el problema, qué alternativas probó, cuánto tiempo o dinero empleó y qué consecuencias tuvo. Evitar preguntas dirigidas, predicciones de compra y opiniones hipotéticas.',
      'Reconducir cumplidos y generalizaciones hacia ejemplos concretos. Una petición de funcionalidad indica algo que investigar: comprender primero su motivo, contexto y prioridad.',
      'Buscar las incertidumbres que podrían invalidar el negocio y preparar unas pocas preguntas de aprendizaje prioritarias. Escuchar sin convertir la entrevista en una defensa o venta prematura de la idea.',
      'Distinguir comentarios amables de compromisos observables de tiempo, reputación o dinero y de un siguiente paso concreto. No contabilizar una intención declarada como conversión ni ingresos.',
      'Acotar segmentos y contrastar patrones entre conversaciones relevantes. Compartir notas y hechos con el equipo, separándolos de interpretaciones; convertir lo aprendido en hipótesis y próximas comprobaciones.',
    ],
  },
};

export function commonMethodology() {
  const sources: MemorySource[] = methodologyBooks.map(book => ({
    id: `book:${book.id}`,
    title: book.title,
    kind: 'methodology_book',
    category: 'common_methodology',
    validation: 'methodological_reference',
    project_id: null,
    project_name: 'Biblioteca común · Síntesis metodológica',
    date: methodologyVersion.split('.')[0],
    excerpt: `${book.author}. Síntesis propia de principios, no texto íntegro. Referencia: ${guides[book.id].pages}.\n${guides[book.id].principles.map((text, index) => `${index + 1}. ${text}`).join('\n')}`,
  }));
  return {version: methodologyVersion, scope: 'common' as const, sources};
}

export const methodologyInstructions = ' La biblioteca methodology es conocimiento metodológico común disponible por defecto en todos los espacios de trabajo. Contiene síntesis atribuidas de libros, no sus textos completos ni un modelo entrenado con ellos. Usa los principios pertinentes para mejorar hipótesis, entrevistas, propuesta de valor y diseño e interpretación de experimentos. Identifica el libro cuando apliques su método; en el chat incluye su ID exacto en source_ids. No inventes citas literales, páginas, contenidos de capítulos no incluidos, datos actuales ni autoridad de los autores sobre un proyecto. Un principio metodológico no es evidencia de mercado ni un aprendizaje validado del equipo. Los hechos autorizados del proyecto y los resultados observados determinan qué se sabe; si contradicen una recomendación general, explica la diferencia y adapta la propuesta. No conviertas cumplidos, clics ni intenciones en validación de demanda o causalidad. No añadas formularios obligatorios ni bloquees la preparación de un borrador por estas pautas. Mantén el criterio de éxito para revisión y definición humana. La biblioteca común nunca contiene, recibe ni comparte información privada entre equipos.';
