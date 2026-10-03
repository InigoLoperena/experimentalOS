import type { Item, Fields, Kind, Member, Activity } from "./model";
const stamp = "2026-10-03T09:00:00Z";
const make = (
  id: string,
  kind: Kind,
  title: string,
  parent_id: string | null,
  fields: Fields = {},
  related_id: string | null = null,
): Item => ({
  id,
  kind,
  title,
  parent_id,
  fields,
  related_id,
  workspace_id: "demo",
  project_id: kind === "project" ? null : "p1",
  owner_id: "demo-user",
  created_by: "demo-user",
  updated_by: "demo-user",
  created_at: stamp,
  updated_at: stamp,
});
export const demoMembers: Member[] = [
  { user_id: "demo-user", name: "Responsable de ejemplo", role: "owner" },
  { user_id: "demo-growth", name: "Equipo Growth · ejemplo", role: "editor" },
];
export const demoItems: Item[] = [
  make("nsm", "north_star", "Objetos recuperados por semana", null, {
    metric: "Recuperaciones confirmadas",
    definition:
      "Un objeto publicado cuya recogida ha sido confirmada por la persona que lo recupera. Sin duplicados ni cancelaciones.",
    frequency: "Semanal",
    value_moment: "Una persona recoge y vuelve a utilizar un objeto.",
    baseline: 100,
    current: 142,
    target: 200,
    unit: "objetos",
    source: "Confirmaciones de recogida · ejemplo",
  }),
  make("g1", "goal", "Aumentar las publicaciones útiles", "nsm", {
    metric: "Publicaciones válidas / semana",
    baseline: 200,
    current: 265,
    target: 400,
    unit: "publicaciones",
    stage: "Activación",
  }),
  make("g2", "goal", "Facilitar que los objetos se recuperen", "nsm", {
    metric: "Tasa de recuperación",
    baseline: 25,
    current: 31,
    target: 40,
    unit: "%",
    stage: "Retención",
  }),
  make(
    "o1",
    "opportunity",
    "El valor de publicar no se entiende al entrar",
    "g1",
    {
      evidence:
        "Ejemplo: en entrevistas, los usuarios no identifican el beneficio de compartir un hallazgo.",
      source: "Entrevistas de ejemplo",
      opportunity_type: "Problema",
      focus: true,
      stage: "Activación",
    },
  ),
  make(
    "o2",
    "opportunity",
    "Los antiguos usuarios no vuelven a publicar",
    "g1",
    {
      evidence: "Ejemplo: la segunda publicación es poco frecuente.",
      source: "Cohorte de ejemplo",
      opportunity_type: "Oportunidad",
      focus: true,
      stage: "Retención",
    },
  ),
  make(
    "o3",
    "opportunity",
    "La incertidumbre sobre el estado frena la recogida",
    "g2",
    {
      evidence: "Ejemplo: usuarios preguntan si el objeto sigue disponible.",
      source: "Conversaciones de ejemplo",
      opportunity_type: "Problema",
      stage: "Activación",
    },
  ),
  make("i1", "idea", "Explicar el beneficio antes del formulario", "o1", {
    impact: 8,
    confidence: 7,
    ease: 9,
    description:
      "Dar una razón concreta para publicar y reducir la incertidumbre.",
  }),
  make("i2", "idea", "Recordatorio con objetos cercanos", "o2", {
    impact: 7,
    confidence: 6,
    ease: 8,
    description: "Probar un mensaje de reactivación contextual.",
  }),
  make("i3", "idea", "Confirmación de disponibilidad reciente", "o3", {
    impact: 9,
    confidence: 5,
    ease: 5,
    description: "Mostrar cuándo se comprobó que el objeto sigue allí.",
  }),
  make(
    "p1",
    "project",
    "Activación de nuevos publicadores",
    null,
    {
      description:
        "Coordinar producto y adquisición para mejorar la primera publicación.",
      status: "En curso",
      start: "2026-10-01",
      end: "2026-12-15",
    },
    null,
  ),
  make("e1", "experiment", "Un beneficio claro antes de publicar", "i1", {
    context: "Las personas no entienden el valor de compartir un hallazgo.",
    hypothesis:
      "Si explicamos el beneficio antes del formulario, más personas completarán una publicación.",
    metric: "Publicación completada / usuario expuesto",
    success_criteria:
      "Mejora relativa de al menos 20%, sin empeorar la calidad de las publicaciones.",
    secondary_metrics: "Porcentaje de publicaciones inválidas",
    audience: "Usuarios nuevos que abren el formulario",
    traffic_plan: "50% mensaje actual y 50% explicación del beneficio",
    risks: "Aumentar las publicaciones de baja calidad",
    start: "2026-10-01",
    impact: 8,
    confidence: 7,
    ease: 9,
    tags: "activación, publicación",
  }),
  make("e2", "experiment", "Email de reactivación con contexto local", "i2", {
    context: "Los antiguos usuarios no vuelven a publicar.",
    hypothesis:
      "Si el email muestra objetos cercanos, más usuarios volverán a publicar esa semana.",
    metric: "Usuarios que publican / emails entregados",
    success_criteria:
      "Alcanzar 6% sin elevar la tasa de bajas por encima de 0,5%.",
    secondary_metrics: "Bajas de suscripción",
    audience: "Usuarios que llevan un mes sin publicar",
    traffic_plan: "50% email habitual y 50% email con contexto local",
    risks: "Aumento de bajas de suscripción",
    start: "2026-10-12",
    impact: 7,
    confidence: 6,
    ease: 8,
    tags: "reactivación, email",
  }),
  make("e3", "experiment", "Anuncio centrado en el valor del hallazgo", "i1", {
    context: "Queremos mejorar la activación desde los anuncios.",
    hypothesis:
      "Mostrar el impacto de recuperar objetos aumentará la activación de los nuevos usuarios.",
    metric: "Coste por usuario que publica",
    success_criteria: "Coste inferior a 6 USD por usuario activado.",
    secondary_metrics: "Tasa de clics y calidad de las publicaciones",
    audience: "Personas que ven la campaña de adquisición",
    traffic_plan: "50% anuncio habitual y 50% mensaje de impacto",
    risks: "Atraer clics que no se conviertan en publicaciones",
    start: "2026-09-10",
    impact: 6,
    confidence: 5,
    ease: 8,
    tags: "adquisición, anuncios",
  }),
  make(
    "l1",
    "learning",
    "El mensaje atrae clics, pero no suficientes publicaciones",
    "e3",
    {
      context: "Prueba del anuncio centrado en el valor del hallazgo.",
      result:
        "Ejemplo ficticio: el coste fue 6,8 USD y no se alcanzó el objetivo de 6 USD.",
      learning:
        "El mensaje despierta interés, pero debemos mejorar la transición a la primera publicación.",
      decision: "Iterar",
      next_steps: "Probar una explicación más concreta antes del formulario.",
      tags: "adquisición, activación",
    },
  ),
];
export const demoActivity: Activity[] = [
  {
    id: "a1",
    actor_id: "demo-user",
    action: "update",
    record_id: "e1",
    title: "Un beneficio claro antes de publicar",
    created_at: stamp,
  },
  {
    id: "a2",
    actor_id: "demo-growth",
    action: "insert",
    record_id: "e2",
    title: "Email de reactivación con contexto local",
    created_at: stamp,
  },
];
