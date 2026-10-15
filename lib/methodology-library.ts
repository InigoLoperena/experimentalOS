// Shared, versioned bibliography. Only public book metadata belongs in this module.
// Add future books here and their original methodological synthesis in methodology-context.ts.
export const methodologyVersion = '2026-10-15.1';
export const methodologyBooks = [
  {
    id: 'la-empresa-experimental',
    title: 'La empresa experimental',
    author: 'José Carlos Cortizo Pérez, Luis Díaz del Dedo, Juanma Varo y Javier Lipúzcoa',
    description: 'Conecta objetivos, hipótesis, experimentos y aprendizajes para decidir con evidencia.',
    cover: '/methodology-books/la-empresa-experimental.webp',
    coverWidth: 476, coverHeight: 705,
    amazonUrl: 'https://www.amazon.com/dp/8409851911',
    edition: 'Español',
  },
  {
    id: 'go-to-market-strategist',
    title: 'Go-To-Market Strategist',
    author: 'Maja Voje',
    description: 'Ayuda a elegir clientes iniciales, propuesta de valor, precio y canales de crecimiento.',
    cover: '/methodology-books/go-to-market-strategist.webp',
    coverWidth: 480, coverHeight: 710,
    amazonUrl: 'https://www.amazon.com/dp/B0CN2H7LPD',
    edition: 'Inglés · síntesis en español',
  },
  {
    id: 'the-mom-test',
    title: 'The Mom Test · El Mom Test',
    author: 'Rob Fitzpatrick',
    description: 'Enseña a entrevistar clientes y detectar necesidades reales sin preguntas que inducen respuestas.',
    cover: '/methodology-books/the-mom-test.webp',
    coverWidth: 400, coverHeight: 608,
    amazonUrl: 'https://www.amazon.com/dp/1671455355',
    edition: 'Español',
  },
] as const;
export type MethodologyBookId = typeof methodologyBooks[number]['id'];
export function methodologyBookForSource(id: string) {
  return methodologyBooks.find(book => `book:${book.id}` === id);
}
