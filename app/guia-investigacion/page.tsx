import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Investigar e importar información útil para tu IA · Xperiments",
  description: "Investiga mercados, problemas y soluciones. Prepara información cualitativa y cuantitativa en CSV, PDF, DOCX y TXT para dar contexto a la IA de tu espacio y diseñar hipótesis y experimentos.",
};

export default function ResearchGuide() {
  return (
    <main className="research-guide">
      <nav className="research-top"><a href="/ia">← Volver a IA</a><span>GUÍA PRÁCTICA · INVESTIGACIÓN Y CONTEXTO</span></nav>
      <header className="research-hero">
        <p className="eyebrow">DE LA INVESTIGACIÓN A MEJORES EXPERIMENTOS</p>
        <h1>Investiga mercados, problemas y soluciones e importa información útil para tu IA</h1>
        <p>La IA de tu espacio de trabajo combina el contexto de sus proyectos con los experimentos, hipótesis y aprendizajes guardados. Esta guía te ayuda a reunir evidencias, organizarlas e importarlas para contrastar tu propuesta de valor y modelo de negocio.</p>
        <p>Para empezar, prepara un documento breve del proyecto, una tabla de alternativas, notas de conversaciones y los datos que ya tengas. No necesitas completarlo todo antes de hacer una primera consulta.</p>
        <div className="research-principle"><strong>Regla principal:</strong> distingue siempre <em>hechos observados</em>, <em>estimaciones</em> e <em>hipótesis por comprobar</em>. Las opiniones de una IA o de una entrevista no son estadísticas del mercado.</div>
      </header>
      <nav className="research-index" aria-label="Contenido de la guía"><strong>Índice rápido</strong>
        <a href="#marco">1. Define qué investigar</a><a href="#secundaria">2. Fuentes existentes</a>
        <a href="#cualitativa">3. Entrevistas y observación</a><a href="#competencia">4. Competidores</a>
        <a href="#cuantitativa">5. Cuantificación del mercado</a><a href="#validacion">6. Primeros tests</a>
        <a href="#sintesis">7. Hallazgos y oportunidades</a><a href="#hipotesis">8. Experimentos</a>
        <a href="#memoria">9. Importa a Xperiments</a><a href="#plan">10. Plan de 14 días</a>
        <a href="#recursos">11. Recursos fiables</a>
      </nav>

      <section id="marco"><h2>1. Empieza por un problema, no por tu solución</h2>
        <p>Redacta en una página la situación que quieres comprender. Una investigación útil responde decisiones concretas, por ejemplo: ¿quién sufre este problema?, ¿cómo lo resuelve ahora?, ¿con qué frecuencia ocurre?, ¿qué coste tiene y qué evidencia tenemos?</p>
        <ol>
          <li><strong>Segmento:</strong> define un usuario muy específico (perfil, comportamiento y contexto), no «todo el mundo».</li>
          <li><strong>Trabajo por resolver:</strong> escribe qué intenta conseguir y en qué circunstancias (jobs-to-be-done).</li>
          <li><strong>Alternativas actuales:</strong> aplicaciones, métodos manuales, contactos o no hacer nada.</li>
          <li><strong>Supuestos arriesgados:</strong> crea una lista de 5–10 afirmaciones que podrían hacer fracasar el proyecto si fueran falsas.</li>
          <li><strong>Decisión próxima:</strong> indica qué cambiarás según cada resultado. Evita investigar solo por acumular documentos.</li>
        </ol>
        <p><strong>Plantilla:</strong> «Creemos que [segmento] tiene [problema] cuando [situación], lo resuelve con [alternativa] y pagaría o cambiaría de hábito porque [motivo]. Necesitamos comprobar [supuesto] antes de [decisión]».</p>
      </section>

      <section id="secundaria"><h2>2. Investiga primero lo que ya existe (desk research)</h2>
        <p>Dedica unas horas a buscar información gratuita, pública y verificable. Usa el mercado y la región de tu proyecto, compara diferentes periodos y guarda siempre la URL, la fecha y la metodología.</p>
        <div className="research-table-wrap"><table><thead><tr><th>Qué necesitas</th><th>Dónde buscar</th><th>Qué recoger</th></tr></thead><tbody>
          <tr><td>Problemas y lenguaje del usuario</td><td>Reseñas en App Store/Google Play, foros especializados, Reddit público, comunidades y preguntas frecuentes</td><td>Quejas concretas, contexto, alternativa y frecuencia observada de menciones; no lo generalices a toda la población.</td></tr>
          <tr><td>Demanda expresada en búsquedas</td><td><a href="https://trends.google.com/trends/explore" target="_blank" rel="noopener noreferrer">Google Trends</a> y <a href="https://ads.google.com/home/tools/keyword-planner/" target="_blank" rel="noopener noreferrer">Keyword Planner</a></td><td>Términos, intención, regiones, estacionalidad, tendencias e intervalos o estimaciones de volumen cuando estén disponibles.</td></tr>
          <tr><td>Tamaño y estructura del mercado</td><td><a href="https://www.indec.gob.ar/" target="_blank" rel="noopener noreferrer">INDEC</a>, <a href="https://ec.europa.eu/eurostat" target="_blank" rel="noopener noreferrer">Eurostat</a>, <a href="https://data.census.gov/" target="_blank" rel="noopener noreferrer">US Census</a>, cámaras sectoriales</td><td>Población relevante, número de empresas, gasto sectorial, cobertura geográfica, periodo y fuente.</td></tr>
          <tr><td>Oferta y publicidad</td><td>Webs, páginas de precios, <a href="https://www.facebook.com/ads/library/" target="_blank" rel="noopener noreferrer">Meta Ad Library</a>, fichas de producto</td><td>Promesas, segmentos, precios publicados, barreras de entrada, mensajes y funcionalidades.</td></tr>
          <tr><td>Web existente (si la hay)</td><td>PostHog, GA4, Search Console, pagos, CRM y soporte</td><td>Usuarios, eventos, conversiones, fricción por paso y periodo con definiciones claras.</td></tr>
        </tbody></table></div>
        <p><strong>Precaución:</strong> Google Trends muestra índices relativos, no número absoluto de búsquedas ni cuota de mercado. Los anuncios visibles no prueban que una campaña sea rentable. Las estadísticas oficiales tampoco prueban intención de compra.</p>
        <p>Para búsquedas cualitativas prueba consultas como «alternativas a [solución]», «[problema] opiniones», «why I stopped using [competidor]», «[solución] expensive», «[problema] reddit». Guarda ejemplos con contexto; no copies datos personales de terceros.</p>
      </section>

      <section id="cualitativa"><h2>3. Entrevista y observa a personas reales</h2>
        <p>Busca participantes del segmento, no solo amigos. Para una exploración inicial puedes empezar con 8–12 conversaciones variadas; ese número no crea una muestra estadísticamente representativa. Observa diferencias entre perfiles y deja constancia de cómo reclutaste a cada uno.</p>
        <h3>Guion de entrevista (20–30 minutos)</h3>
        <ol>
          <li>«Cuéntame la última vez que intentaste [tarea]». Sitúa fecha y contexto.</li>
          <li>«¿Qué provocó que necesitaras resolverlo?»</li>
          <li>«¿Qué pasos seguiste realmente? ¿Puedes enseñármelos?»</li>
          <li>«¿Qué fue lo más difícil o lento? ¿Cuánto tiempo/dinero perdiste?»</li>
          <li>«¿Qué herramientas o personas utilizaste? ¿Por qué esas?»</li>
          <li>«¿Qué ocurrió cuando falló? ¿Lo abandonaste o buscaste otra alternativa?»</li>
          <li>«¿Has pagado por resolverlo? ¿Cuánto y cuándo?»</li>
          <li>«¿Qué no te he preguntado que debería conocer?»</li>
        </ol>
        <p><strong>Evita</strong> «¿Te gusta mi idea?» y «¿Pagarías 10 €?»: inducen respuestas agradables pero poco predictivas. Prioriza comportamientos pasados, demostraciones y costes reales. Pide consentimiento antes de grabar y anonimiza las notas.</p>
        <h3>Observación y pruebas de tareas</h3>
        <p>Si ya tienes prototipo, asigna 3–5 tareas realistas a participantes del segmento, sin explicarles dónde hacer clic. Observa dónde dudan, errores, abandonos y tiempo por tarea. Anota <em>qué sucedió</em> y después <em>por qué crees que sucedió</em> en campos separados. Un test pequeño ayuda a descubrir problemas; no te dice qué porcentaje de todo el mercado los sufre.</p>
        <p>Otros métodos: diario de uso durante varios días, visitas de campo, llamadas de ventas y análisis de tickets de soporte. Triangula lo declarado con lo que se observa.</p>
      </section>

      <section id="competencia"><h2>4. Analiza competidores y alternativas, también la inacción</h2>
        <p>Selecciona de 5 a 10 alternativas directas e indirectas. Crea una tabla por segmento con: propuesta de valor, primer paso de onboarding, precio y condiciones, funcionalidades relevantes, reseñas positivas y negativas, canales de adquisición y diferencial. Apunta la fecha de cada observación.</p>
        <p>Haz una <strong>prueba del recorrido</strong>: visita su landing, intenta registrarte, realiza la tarea principal y registra capturas propias y pasos. Busca fricciones como pedir datos demasiado pronto, no explicar el valor, desconfianza, costes sorpresa o falta de oferta local. Una función ausente no es automáticamente una oportunidad: comprueba que los usuarios la necesiten.</p>
      </section>

      <section id="cuantitativa"><h2>5. Calcula señales cuantitativas sin crear falsas certezas</h2>
        <h3>Estimación bottom-up del mercado</h3>
        <p>Empieza por cuántos clientes podrían ser realmente elegibles en tu geografía, con qué frecuencia aparece la necesidad y cuánto gastan hoy. Por ejemplo: 20.000 negocios identificados × 20 % con una necesidad confirmada × 120 € de gasto anual = <strong>480.000 €/año de gasto potencial bajo esos supuestos</strong>. No es una venta prevista ni un TAM validado. Anota de dónde sale cada factor y un escenario bajo, central y alto.</p>
        <h3>Indicadores según la fase</h3>
        <ul>
          <li><strong>Antes de lanzar:</strong> volumen de búsquedas estimado, entrevistas con problema real, porcentaje que utiliza una alternativa, coste de la tarea, clics o solicitudes genuinas en una landing.</li>
          <li><strong>Primeros usuarios:</strong> visitas únicas, registros/verificaciones, usuarios activados, tiempo hasta primer valor y tasa de abandono por paso.</li>
          <li><strong>Uso recurrente:</strong> retención por cohortes y periodo, frecuencia de tarea completada, satisfacción cualitativa, repetición y referidos.</li>
          <li><strong>Negocio:</strong> solicitudes, pagos, ingreso por transacción, margen, CAC por canal, LTV estimado y tasa de devolución, indicando incertidumbre.</li>
        </ul>
        <p><strong>Fórmulas:</strong> conversión = acciones deseadas / usuarios elegibles del paso anterior; activación = usuarios que completan el primer valor / nuevos usuarios; retención semana 4 = usuarios de una cohorte que vuelven a realizar el evento clave en semana 4 / total inicial de esa cohorte. Define «usuario», «evento» y ventana temporal antes de calcular.</p>
        <p>Registra siempre numerador, denominador, fechas, canal, país y si son datos reales o estimaciones. No compares periodos ni segmentos con definiciones distintas; una tasa basada en 4 personas puede ser muy inestable.</p>
      </section>

      <section id="validacion"><h2>6. Obtén evidencia cuando todavía no tienes producto</h2>
        <ol>
          <li><strong>Landing con propuesta de valor:</strong> presenta problema y beneficio en lenguaje del cliente; registra visitas y clics en «Quiero probarlo».</li>
          <li><strong>Lista de espera cualificada:</strong> mide qué perfiles se apuntan de verdad, canal y tasa de confirmación, cumpliendo privacidad y consentimiento.</li>
          <li><strong>Concierge MVP:</strong> resuelve manualmente el problema de 5–10 usuarios y documenta tiempo, satisfacción, repetición y disposición real a pagar.</li>
          <li><strong>Prototipo de baja fidelidad:</strong> observa tareas y dudas sin necesidad de programar el producto completo.</li>
          <li><strong>Test de precios transparente:</strong> presenta opciones o solicita compromisos reales; no cobres por algo que no puedes entregar ni simules disponibilidad.</li>
          <li><strong>Canales de adquisición controlados:</strong> lanza pruebas pequeñas por mensaje o segmento y mide tráfico cualificado, clics y pasos posteriores; incluye el presupuesto de cada variante.</li>
        </ol>
        <p>Antes de empezar define cuánto tráfico/tiempo dedicarás, cómo registrarás los resultados y qué decisión tomarás según ellos. Los clics prueban interés en un mensaje, no necesariamente retención ni negocio sostenible.</p>
      </section>

      <section id="sintesis"><h2>7. Convierte notas dispersas en hallazgos y oportunidades</h2>
        <p>Para cada observación utiliza una ficha breve con los siguientes campos:</p>
        <div className="research-template">
          <strong>Ficha de evidencia</strong>
          <p><b>Hallazgo:</b> «En 6 de 9 entrevistas, el usuario relató que...» (describe la muestra, no lo extrapoles).</p>
          <p><b>Fuente:</b> entrevista, reseña, informe oficial o evento de analítica; URL/ID, fecha, segmento y método.</p>
          <p><b>Dato:</b> cita anonimizada, número con denominador, o captura/observación propia.</p>
          <p><b>Confianza:</b> baja / media / alta y motivo (sesgo de selección, tamaño, actualidad, independencia).</p>
          <p><b>Problema o fricción:</b> qué impide completar el trabajo o recibir valor.</p>
          <p><b>Oportunidad:</b> qué podrías mejorar, para quién y en qué momento.</p>
          <p><b>Pregunta abierta:</b> qué evidencia falta y cómo conseguirla.</p>
        </div>
        <p>Agrupa problemas repetidos; compara por segmento y etapa del recorrido. Prioriza por gravedad, frecuencia observada, coste del problema, relación con tu propuesta de valor y facilidad de comprobarlo. No confundas «se menciona mucho en internet» con prevalencia poblacional.</p>
      </section>

      <section id="hipotesis"><h2>8. Transforma oportunidades en hipótesis y experimentos</h2>
        <p>Usa el árbol de Xperiments: <strong>North Star Metric → objetivos e input metrics → oportunidades → ideas → experimentos</strong>. Una oportunidad describe un problema, no la solución. Una idea propone cómo aliviarlo. Un experimento busca refutar o confirmar una hipótesis concreta.</p>
        <div className="research-template"><strong>Ejemplo: marketplace local</strong>
          <p><b>Evidencia:</b> 7 entrevistas identifican dudas sobre la disponibilidad antes de desplazarse. Muestra pequeña y no representativa.</p>
          <p><b>Oportunidad:</b> reducir la incertidumbre al solicitar un producto cercano.</p>
          <p><b>Hipótesis:</b> «Si mostramos hora de última confirmación, más usuarios completarán una solicitud».</p>
          <p><b>Métrica principal:</b> solicitudes completadas / usuarios que abrieron la ficha.</p>
          <p><b>Guardrails:</b> cancelaciones, reclamaciones, latencia y carga operativa.</p>
          <p><b>Diseño:</b> comparar dos variantes con asignación aleatoria o, si no hay tráfico suficiente, test cualitativo/concierge sin hacer afirmaciones estadísticas.</p>
          <p><b>Criterio de éxito:</b> fijar antes una mejora mínima relevante, una ventana y un método de análisis; no escogerlos al ver los datos.</p>
        </div>
        <p>Usa ICE para ordenar ideas, pero no confundas una puntuación subjetiva con prueba de impacto. Registra resultado, límites de la muestra, aprendizaje y siguiente decisión aunque el experimento sea negativo.</p>
      </section>

      <section id="memoria"><h2>9. Cómo cargar la investigación en la memoria de Xperiments</h2>
        <p>Abre <strong>IA → Importar información</strong> y selecciona un archivo. También puedes abrir <strong>Añadir texto</strong>, escribir un título y pegar tus notas. La información queda en el espacio de trabajo y puede dar contexto a sus distintos proyectos. Indica el proyecto en el título y dentro del documento para que la IA pueda relacionarlo correctamente.</p>
        <p>Añade siempre la fuente, la fecha, el segmento y si se trata de una observación, una estimación o una hipótesis. Anonimiza las entrevistas y evita incluir contraseñas o información personal innecesaria.</p>
        <div className="research-table-wrap"><table><thead><tr><th>Formato</th><th>Qué aporta</th><th>Cómo prepararlo</th></tr></thead><tbody>
          <tr><td>CSV</td><td>Métricas, entrevistas clasificadas o comparativas.</td><td>Una fila por observación; nombres claros de columnas, periodo, unidades, conteos y denominadores. Guarda en UTF-8.</td></tr>
          <tr><td>PDF</td><td>Informes, investigaciones y documentación.</td><td>Usa texto seleccionable. Si está escaneado, aplica reconocimiento de texto antes de importarlo.</td></tr>
          <tr><td>DOCX</td><td>Entrevistas, estrategia y síntesis.</td><td>Usa títulos y texto en el documento; explica las conclusiones de gráficos e imágenes con palabras.</td></tr>
          <tr><td>TXT</td><td>Contexto, notas y hallazgos breves.</td><td>Separa por proyecto y tema, con fecha y referencias.</td></tr>
        </tbody></table></div>
        <p>Se admiten archivos de hasta 10 MB. Para poder consultar su contenido, el PDF debe tener como máximo 200 páginas y el texto extraído no superar 100.000 caracteres. Divide una copia por temas si excede esos límites. Un original puede quedar guardado aunque su texto no se haya podido procesar; comprueba el estado que muestra la importación.</p>
        <h3>Qué importar primero si empiezas desde cero</h3>
        <ol>
          <li><strong>01 · Contexto del proyecto:</strong> usuarios objetivo, propuesta de valor, territorio, alternativa actual, modelo de negocio, NSM y supuestos.</li>
          <li><strong>02 · Fuentes del mercado:</strong> informes públicos, enlaces, estadísticas con denominadores y año, demanda de búsquedas (indicando si es índice).</li>
          <li><strong>03 · Competencia:</strong> tabla con competidor, posicionamiento, precio, fecha, URL y limitaciones.</li>
          <li><strong>04 · Entrevistas:</strong> notas anonimizadas, fecha, segmento, frases sobre conductas pasadas, fricciones y modo de reclutamiento.</li>
          <li><strong>05 · Datos o pruebas:</strong> conversiones y conteos de una landing o prototipo, segmentación, periodo y criterio de atribución.</li>
          <li><strong>06 · Síntesis:</strong> hipótesis, confianza, oportunidades priorizadas y lo que todavía desconoces.</li>
        </ol>
        <h3>Plantilla de CSV utilizable</h3>
        <p>Ejemplo ficticio: sustituye estos datos por observaciones reales. Un resultado observado no demuestra por sí solo una hipótesis.</p>
        <pre>{`proyecto,fecha,segmento,tipo,observacion,numerador,denominador,unidad,fuente,estado,limitaciones
Proyecto ejemplo,2026-10-13,usuarios nuevos,entrevista,"Dice que no encontró la opción",,,,Entrevista 03,relato del participante,muestra no representativa
Proyecto ejemplo,2026-10-13,visitantes,landing,registros,8,80,personas,Analytics,resultado observado,periodo de siete días sin validación de email`}</pre>
        <p>Revisa la codificación UTF-8, conserva las comillas alrededor de textos con comas y añade al nombre del archivo su fecha y tema. Nunca fabriques entrevistas, cifras, referencias o competidores. Cuando una cifra es estimada, etiquétala claramente.</p>
        <h3>Preguntas útiles para la IA una vez importado</h3>
        <ul>
          <li>«Separa lo que está demostrado, lo inferido y lo desconocido. Cita cada fuente y su fecha».</li>
          <li>«Dame diez fricciones detectadas, agrupadas por segmento y fase del recorrido; indica evidencia y confianza».</li>
          <li>«Propón cinco oportunidades priorizadas por impacto potencial, incertidumbre y coste de validación».</li>
          <li>«Diseña tres experimentos baratos para nuestra fase actual, con métrica, guardrails y criterio de éxito definido previamente».</li>
          <li>«¿Qué investigación necesitamos hacer antes de poder defender estas hipótesis?».</li>
        </ul>
        <p>Para conectar la investigación con la estrategia, prueba: «Para el proyecto indicado, relaciona las fuentes importadas con nuestro objetivo y GOI Tree. Separa hechos, hipótesis y desconocidos; cita las fuentes disponibles y propón un experimento para comprobar la suposición más arriesgada, con métrica y criterio de éxito».</p>
        <p><strong>Cómo se utiliza:</strong> tus archivos y conocimientos se guardan en Supabase, dentro de tu espacio. Al consultar la IA se recupera contexto autorizado y relevante y se envía a OpenAI para preparar la respuesta. No se entrena un modelo propio ni se envían todos los documentos en cada pregunta. Importar un CSV aporta contexto; no crea automáticamente métricas en los paneles de experimentos. Revisa las conclusiones y valida los aprendizajes antes de tratarlos como hechos.</p>
      </section>

      <section id="plan"><h2>10. Plan práctico para los primeros 14 días</h2>
        <p>Es una propuesta adaptable a tu disponibilidad y al acceso a participantes; no es un requisito para empezar a usar la IA.</p>
        <div className="research-table-wrap"><table><thead><tr><th>Día</th><th>Acción</th><th>Entregable</th></tr></thead><tbody>
          <tr><td>1–2</td><td>Delimitar segmento, problema y 5 supuestos críticos.</td><td>Ficha inicial de proyecto + preguntas de investigación.</td></tr>
          <tr><td>3–4</td><td>Investigar fuentes oficiales, búsquedas, reseñas y 5 competidores.</td><td>Registro de fuentes con fechas, comparativa y primeras señales.</td></tr>
          <tr><td>5–8</td><td>Realizar entrevistas con perfiles variados y observar tareas reales.</td><td>Notas anonimizadas, fricciones y citas con contexto.</td></tr>
          <tr><td>9–10</td><td>Diseñar y probar una landing, prototipo o servicio manual.</td><td>Primeras métricas con conteos, denominadores y segmentos.</td></tr>
          <tr><td>11–12</td><td>Triangular cualitativo + cuantitativo y puntuar incertidumbre.</td><td>Ranking de oportunidades y datos por comprobar.</td></tr>
          <tr><td>13–14</td><td>Importar hallazgos, alimentar el GOI Tree y definir 2–3 experimentos.</td><td>Memoria inicial útil y plan de aprendizaje medible.</td></tr>
        </tbody></table></div>
        <p>Al acabar deberías poder responder: «¿Quién tiene un problema real?», «¿Cómo lo sabemos?», «¿Qué alternativa utiliza?», «¿Qué ignoramos todavía?» y «¿Cuál es el siguiente experimento más barato que puede cambiar nuestra decisión?».</p>
      </section>

      <section id="recursos"><h2>11. Lecturas y herramientas contrastables</h2>
        <ul className="research-resources">
          <li><a href="https://www.nngroup.com/articles/user-interviews/" target="_blank" rel="noopener noreferrer">Nielsen Norman Group · User Interviews 101 ↗</a> — entrevistas abiertas, sesgos y límites de los relatos.</li>
          <li><a href="https://www.nngroup.com/articles/interview-guide/" target="_blank" rel="noopener noreferrer">NN/g · Writing an Effective Guide for a UX Interview ↗</a> — cómo preparar un guion útil.</li>
          <li><a href="https://developers.google.com/search/docs/monitor-debug/trends-start?hl=es" target="_blank" rel="noopener noreferrer">Google · Empezar con Google Trends ↗</a> — qué miden sus datos y cómo interpretarlos.</li>
          <li><a href="https://www.strategyzer.com/library/the-value-proposition-canvas" target="_blank" rel="noopener noreferrer">Strategyzer · Value Proposition Canvas ↗</a> — segmentos, trabajos, frustraciones y propuestas de valor.</li>
          <li><a href="https://www.facebook.com/ads/library/" target="_blank" rel="noopener noreferrer">Meta · Biblioteca de anuncios ↗</a> — anuncios públicos de competidores, no rentabilidad.</li>
          <li><a href="https://www.indec.gob.ar/" target="_blank" rel="noopener noreferrer">INDEC</a>, <a href="https://ec.europa.eu/eurostat" target="_blank" rel="noopener noreferrer">Eurostat</a> y <a href="https://data.census.gov/" target="_blank" rel="noopener noreferrer">US Census</a> — bases para cifras demográficas y económicas.</li>
        </ul>
        <p className="research-end-note">Esta guía es un procedimiento de investigación, no datos sobre tu mercado concreto. Su calidad depende de documentar evidencias comprobables, respetar la privacidad y aprender de pruebas reales.</p>
        <a href="/ia" className="research-back">← Volver a IA</a>
      </section>
    </main>
  );
}
