"use client";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FlaskConical,
  GitBranch,
  CircleHelp,
  Layers,
  Lightbulb,
  LogOut,
  LogIn,
  Plus,
  RefreshCw,
  Search,
  Compass,
  Target,
  Flag,
  BarChart3,
  Users,
  X,
  LayoutGrid,
  Microscope,
  UserRound,
  Plug,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { experimentFields, experimentSections, normalizeExperiment } from "@/lib/experiments";
import { getGoiHierarchy } from "@/lib/goi-hierarchy";
import { MvpExperimentation } from "./mvp-experimentation";
import { MvpHierarchy } from "./mvp-hierarchy";
import { ProblemonSection } from "./problemon-section";
import { EditorDictation } from "./editor-dictation";
import { getProblemon, isProblemon } from "@/lib/problemon";
import { demoItems, demoMembers, demoActivity } from "@/lib/demo";
import { Avatar, ProfileDialog, type PersonalProfile } from "./profile-settings";
import { RecordAttachments } from "./record-attachments";
import { BrandIdentity } from "./brand-identity";
import { TeamAccess } from "./team-access";
import { BackupDialog, type BackupFormat } from "./backup-dialog";
import { PostHogResults } from "./posthog-results";
import {PosthogPreparation} from './posthog-preparation';
import {posthogChannels} from '@/lib/posthog-options';
import { PostHogProjectPanel } from "./posthog-project-panel";
import { ExperimentMonitoring } from "./experiment-monitoring";
import { MetaExperimentDelivery } from './meta-experiment-delivery';
import {GoogleAdsPreparation} from './google-ads-preparation';
import { ExperimentAssistant } from "./experiment-assistant";
import { StrategicAI } from './strategic-ai';
import {viewForPath,pathForView,type SectionView} from '@/lib/section-routes';
import { AIBrainIcon } from './ai-brain-icon';
import {applyPreparation,type Preparation} from '@/lib/ai-preparation';
import {ExperimentExecution,ExecutionDetails} from './experiment-execution';
import {IntegrationSettings} from './integration-settings';
import {MemberPermissions} from './member-permissions';
import {canRecord,type RecordAction} from '@/lib/permissions';
import {addFileAttachment} from '@/lib/attachment-service';
import type { Backup } from "@/lib/backup";
import { fetchBackup, fetchCsvRecords } from "@/lib/backup-service";
import { deleteWorkspaceRecord, loadWorkspaceRecords, ensureProjectNorthStar, projectNorthStarRecord } from "@/lib/record-service";
import { createPersonalTeamSpace, getPublicPreview, listTeamSpaces, selectTeamSpace } from "@/lib/internal-space";
import { registerAccount } from "@/lib/auth-service";
import { attachmentBucket, supportsAttachments, type Attachment } from "@/lib/attachments";
import { cleanupAttachments } from "@/lib/attachment-service";
import {
  ancestors,
  goalParent,
  Item,
  Member,
  Activity,
  Fields,
  Kind,
  kinds,
  parents,
  progress,
  score,
  validate,
} from "@/lib/model";
type View = SectionView;
type Workspace = { id: string; name?: string };
type Invitation = {
  id: string;
  token: string;
  role: string;
  expires_at: string;
  used_by: string | null;
};
type InvitationPreview = {
  team_name: string;
  role: "editor" | "viewer";
  expires_at: string;
};
type RecordComment = {
  id: string;
  workspace_id: string;
  record_id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
};
type Field = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "number" | "date" | "select" | "checkbox";
  options?: string[];
  required?: boolean;
};
const numberFields: Field[] = [
  { key: "metric", label: "Métrica", required: true },
  { key: "baseline", label: "Valor inicial", type: "number" },
  { key: "current", label: "Valor actual", type: "number" },
  { key: "target", label: "Objetivo", type: "number" },
  { key: "unit", label: "Unidad" },
];
const iceFields: Field[] = [
  { key: "impact", label: "Impacto (1–10)", type: "number" },
  { key: "confidence", label: "Confianza (1–10)", type: "number" },
  { key: "ease", label: "Facilidad (1–10)", type: "number" },
];
const schemas: Record<Kind, Field[]> = {
  north_star: [
    {
      key: "definition",
      label: "Definición y regla de cálculo",
      type: "textarea",
      required: true,
    },
    {
      key: "value_moment",
      label: "Momento en que el usuario recibe valor",
      type: "textarea",
    },
    ...numberFields,
    {
      key: "frequency",
      label: "Frecuencia",
      type: "select",
      options: ["Diaria", "Semanal", "Mensual"],
    },
    { key: "source", label: "Fuente de datos" },
  ],
  goal: [
    { key: "description", label: "Descripción / resultado buscado", type: "textarea" },
    { key: "metric", label: "Indicador / KPI" },
    { key: "baseline", label: "Valor inicial", type: "number" },
    { key: "current", label: "Valor actual", type: "number" },
    { key: "target", label: "Valor objetivo", type: "number" },
    { key: "unit", label: "Unidad de medida" },
    { key: "source", label: "Fuente / método de medición" },
    { key: "period", label: "Periodo" },
  ],
  hypothesis: [
    { key: "description", label: "Descripción / propuesta", type: "textarea" },
    { key: "belief", label: "¿Qué creemos que es cierto?", type: "textarea" },
    { key: "reason", label: "¿Por qué lo creemos?", type: "textarea" },
    { key: "validation_need", label: "¿Qué necesitamos comprobar?", type: "textarea" },
    { key: "metric", label: "KPI al que contribuye" },
    { key: "experimental_focus", label: "Foco experimental: quién, qué y por qué", type: "textarea" },
    { key: "evidence", label: "Evidencia para priorizar", type: "textarea" },
    ...iceFields,
  ],
  research: [
    { key: "description", label: "Descripción", type: "textarea" },
    { key: "audience", label: "Target" },
    { key: "method", label: "Método", type: "select", options: ["Entrevistas", "Encuestas", "Análisis de mercado", "Investigación documental", "Observación", "Otro"] },
    { key: "findings", label: "Hallazgos", type: "textarea" },
    { key: "learning", label: "Aprendizaje", type: "textarea" },
  ],
  opportunity: [
    {
      key: "evidence",
      label: "Evidencia de la oportunidad",
      type: "textarea",
      required: true,
    },
    { key: "source", label: "Fuente / enlace de la evidencia" },
    {
      key: "focus",
      label: "Oportunidad prioritaria (máximo 5)",
      type: "checkbox",
    },
  ],
  idea: [
    {
      key: "description",
      label: "Qué proponemos y por qué",
      type: "textarea",
      required: true,
    },
    { key: "metric", label: "KPI al que contribuye", required: true },
    {
      key: "experimental_focus",
      label: "Foco experimental: quién, qué y por qué",
      type: "textarea",
    },
    { key: "evidence", label: "Evidencia para priorizar", type: "textarea" },
    ...iceFields,
  ],
  experiment: experimentFields,
  learning: [
    { key: "context", label: "Contexto", type: "textarea" },
    { key: "result", label: "Qué ocurrió / resultado", type: "textarea" },
    {
      key: "evidence",
      label: "Evidencia o enlace al análisis",
      type: "textarea",
    },
    {
      key: "learning",
      label: "Qué aprendimos",
      type: "textarea",
      required: true,
    },
    {
      key: "decision",
      label: "Decisión",
      type: "select",
      options: ["", "Escalar", "Iterar", "Descartar", "Inconcluso"],
    },
    { key: "next_steps", label: "Qué haremos después", type: "textarea" },
    { key: "tags", label: "Etiquetas (separadas por comas)" },
  ],
  objective: [
    { key: "description", label: "Qué queremos conseguir", type: "textarea" },
    { key: "period", label: "Periodo (ej. 2026-Q4)" },
  ],
  kr: [...numberFields, { key: "period", label: "Periodo" }],
  project: [
    {
      key: "description",
      label: "Propuesta de valor / descripción breve",
      type: "textarea",
    },
    { key: "site_url", label: "Web del proyecto" },
    { key: "north_star", label: "North Star Metric" },
    { key: "analytics_url", label: "Enlace a Analytics" },
    { key: "posthog_project_id", label: "ID del proyecto en PostHog" },
    { key: "posthog_host", label: "Host de PostHog (ej. https://us.posthog.com)" },
    { key: "tasks_url", label: "Otro enlace 1" },
    { key: "meeting_notes_url", label: "Otro enlace 2" },
    { key: "other_url", label: "Otro enlace 3" },
  ],
};
const mvpSchemas: Partial<Record<Kind, Field[]>> = {
  project: [
    { key: "site_url", label: "Web" },
    { key: "targets", label: "Targets (uno por línea)", type: "textarea" },
    { key: "value_propositions", label: "Propuestas de valor (una por línea)", type: "textarea" },
    { key: "monetization_channels", label: "Vías de monetización (una por línea)", type: "textarea" },
    { key: "north_star", label: "North Star Metric" },
  ],
  opportunity: [
    { key: "description", label: "Descripción", type: "textarea" },
    { key: "opportunity_type", label: "Tipo", type: "select", options: ["Problema", "Oportunidad"] },
    { key: "evidence", label: "Evidencias disponibles", type: "textarea" },
    { key: "source", label: "Fuentes y enlaces", type: "textarea" },
  ],
  hypothesis: schemas.hypothesis,
  research: [
    { key: "description", label: "Descripción", type: "textarea" },
    { key: "audience", label: "Target" },
    { key: "method", label: "Método", type: "select", options: ["Entrevistas", "Encuestas", "Análisis de mercado", "Investigación documental", "Observación", "Otro"] },
    { key: "findings", label: "Hallazgos", type: "textarea" },
    { key: "learning", label: "Aprendizaje", type: "textarea" },
  ],
  // Experiments share schemas.experiment with Growth Tree; no separate MVP form.
};
const experimentalBookCover = "/la-empresa-experimental.svg";
const experimentalBookAmazon = "https://www.amazon.es/gp/product/B0GXPMFM7P/ref=kinw_myk_ro_title";
const experimentalBookPdf = "https://drive.google.com/file/d/1dpZhjPz76bqfH8lcxpw9CppshkaDusxK/view?usp=sharing";

function ExperimentalBookBanner() {
  return (
    <aside className="experimental-book-banner">
      <img src={experimentalBookCover} alt="Portada de La Empresa Experimental" />
      <div className="experimental-book-copy">
        <p>
          Experimental Innovation OS está basado en la metodología del libro
          <strong> La Empresa Experimental</strong> de Product Hackers.
        </p>
        <div className="experimental-book-links">
          <a href={experimentalBookAmazon} target="_blank" rel="noreferrer">
            Amazon <ArrowUpRight size={13} />
          </a>
          {/* PDF temporalmente oculto. Mantener experimentalBookPdf para reactivarlo exactamente igual. */}
        </div>
      </div>
    </aside>
  );
}

function PublicViewBanner({ onSignup }: { onSignup: () => void }) {
  return (
    <aside className="public-view-banner">
      <div>
        <strong>Vista pública.</strong>
        <p>
          Estás explorando los proyectos, experimentos, aprendizajes y Growth Tree publicados por Imagine Builder en modo solo lectura.
        </p>
      </div>
      <button onClick={onSignup}>Crear mi espacio gratis</button>
    </aside>
  );
}

const nav: { id: View; label: string; icon: typeof Compass | typeof AIBrainIcon }[] = [
  { id: "projects", label: "Proyectos", icon: LayoutGrid },
  { id: "mvp", label: "MVPs Tree", icon: Microscope },
  { id: "learning", label: "Documentar aprendizajes", icon: BookOpen },
  { id: "ai", label: "IA", icon: AIBrainIcon },
  { id: "map", label: "Growth Tree", icon: GitBranch },
  { id: "team", label: "Equipo", icon: Users },
  { id: "integrations", label: "Integraciones", icon: Plug },
  { id: "method", label: "Cómo utilizar Xperiments", icon: CircleHelp },
];
const viewLabels: Partial<Record<View, string>> = {
 problemon:"Problema principal", mvp_problemon:"Problema principal",
 goals: "Objetivos", input_metrics: "Input Metrics", opportunities: "Oportunidades-problemas", ideas: "Hipótesis",
 experiments: "Experimentos",
 mvp_problems: "Problemas u Oportunidades", mvp_main_hypothesis: "Hipótesis principal", mvp_hypotheses: "Hipótesis",
 mvp_experiments: "Experimentos · MVPs", mvp_research: "Investigación",
};
const mvpViews = ["mvp", "mvp_problemon", "mvp_problems", "mvp_main_hypothesis", "mvp_hypotheses", "mvp_experiments", "mvp_research"] as const;
const mvpSubsections = [
 { id:"mvp_problemon", label:"Problema principal", icon:Flag, accent:"problemon" },
 { id:"mvp_problems", label:"Problemas u Oportunidades", icon:Search, accent:"problems" },
 { id:"mvp_main_hypothesis", label:"Hipótesis principal", icon:Lightbulb, accent:"hypotheses" },
 { id:"mvp_hypotheses", label:"Hipótesis", icon:Lightbulb, accent:"hypotheses" },
 { id:"mvp_experiments", label:"Experimentos", icon:FlaskConical, accent:"experiments" },
 { id:"mvp_research", label:"Investigación", icon:Microscope, accent:"research" },
] as const;
/** Consistent, explicit color for labels and icons in both sidebars. */
function treeAccentColor(accent:string){
 if(accent==="problemon"||accent==="problems"||accent==="opportunity")return "var(--red-text)";
 if(accent==="hypotheses"||accent==="hypothesis")return "var(--hypothesis-accent)";
 if(accent==="experiments"||accent==="experiment")return "var(--experiment-accent)";
 if(accent==="research")return "#75c1ff";
 return undefined;
}
function goalVisualClass(item: Item): "objective" | "input-metric" | "" {
  if (item.kind !== "goal") return "";
  return item.fields.goi_section === "input_metrics" ? "input-metric" : "objective";
}
function GoalTypeIcon({ item, size = 16 }: { item: Item; size?: number }) {
  return goalVisualClass(item) === "input-metric"
    ? <BarChart3 size={size} aria-hidden="true" />
    : <Target size={size} aria-hidden="true" />;
}
function IconFor({ kind }: { kind: Kind }) {
  const I =
    kind === "north_star"
      ? Compass
      : kind === "experiment"
        ? FlaskConical
        : kind === "hypothesis"
          ? Lightbulb
          : kind === "research"
            ? Microscope
          : kind === "opportunity"
            ? Search
            : Target;
  return <I size={16} />;
}
function Badge({ state }: { state: unknown }) {
  return (
    <span
      className={
        "badge " +
        (state === "En curso"
          ? "running"
          : state === "Finalizado"
            ? "done"
            : "")
      }
    >
      {String(state || "Backlog")}
    </span>
  );
}
function Meter({ value }: { value: number }) {
  return (
    <div className="meter">
      <span style={{ width: value + "%" }} />
    </div>
  );
}
function Action({
  children,
  onClick,
  disabled = false,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      className={"btn " + className}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function projectUrl(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}
function projectDomain(value: unknown) {
  const url = projectUrl(value);
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return String(value || "");
  }
}
function projectLogo(value: unknown, title?: string) {
  const key = String(title || "").trim().toLowerCase();
  const projectLogos: Record<string, string> = {
    greenhunt: "/project-logos/greenhunt.png",
    "greenhunt store": "/greenhunt-store-logo.png",
    booklinks: "/project-logos/booklinks.PNG",
    greenroute: "/project-logos/greenroute.PNG",
    smartjunk: "/project-logos/smartjunk.PNG",
  };
  if (projectLogos[key]) return projectLogos[key];
  const domain = projectDomain(value);
  return domain
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`
    : "";
}
// Do not invent project descriptions: only display text entered by a person
// or content explicitly applied from an AI proposal and saved by that person.
function projectDescription(project: Item) {
  return String(project.fields.description || "").trim() || "Descripción pendiente de completar.";
}
function ProjectLogo({ project, size = "normal" }: { project: Item; size?: "normal" | "small" }) {
  const logo = projectLogo(project.fields.site_url, project.title);
  return (
    <span className={"project-logo " + (size === "small" ? "small" : "")} aria-hidden="true">
      {logo ? <img src={logo} alt="" /> : <LayoutGrid size={size === "small" ? 20 : 26} />}
    </span>
  );
}
export default function Home() {
  const [view, setView] = useState<View>("projects");
  useEffect(()=>{
    const restore = () => {
      const section=viewForPath(window.location.pathname);
      if(section){setView(section);setFilter('');}
    };
    restore();
    window.addEventListener('popstate',restore);
    return ()=>window.removeEventListener('popstate',restore);
  },[]);
  function navigateView(destination:View){
    setView(destination);
    if (!(mvpViews as readonly string[]).includes(destination)) setMvpEditor(false);
    setFilter('');
    const path=pathForView(destination);
    if(window.location.pathname!==path) window.history.pushState(window.history.state,'',path);
  }
  const [allItems, setItems] = useState<Item[]>([]);
  const [projectId, setProjectId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [publicMode, setPublicMode] = useState(false);
  const [authRequested, setAuthRequested] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [profile, setProfile] = useState<PersonalProfile>({ name: "Miembro" });
  const [profileReady, setProfileReady] = useState(!supabase);
  const [showProfile, setShowProfile] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [monitoringBusy, setMonitoringBusy] = useState(false);
  const [integrationBusy,setIntegrationBusy]=useState(false);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [draftFiles,setDraftFiles]=useState<File[]>([]);
  const [demo, setDemo] = useState(!supabase);
  const [loading, setLoading] = useState(!!supabase);
  const [toast, setToast] = useState("");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Item | null>(null);
  const [metaPreparationTarget,setMetaPreparationTarget]=useState<string|null>(null);
  const [googlePreparationTarget,setGooglePreparationTarget]=useState<string|null>(null);
  const [posthogPreparationTarget,setPosthogPreparationTarget]=useState<string|null>(null);
  const [draft, setDraft] = useState<Item | null>(null);
  const [mvpEditor, setMvpEditor] = useState(false);
  useEffect(()=>setDraftFiles([]),[draft?.id]);
  const [selectedHistory, setSelectedHistory] = useState<Activity[]>([]);
  const [recordComments, setRecordComments] = useState<RecordComment[]>([]);
  const [demoComments, setDemoComments] = useState<Record<string, RecordComment[]>>({});
  const [commentText, setCommentText] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attachmentsBusy, setAttachmentsBusy] = useState(false);
  const [demoAttachments, setDemoAttachments] = useState<Record<string, Attachment[]>>({});
  const [publicAttachments, setPublicAttachments] = useState<Attachment[]>([]);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [inviteRole, setInviteRole] = useState("editor");
  const [inviteUrl, setInviteUrl] = useState("");
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [error, setError] = useState("");
  const [schemaReady, setSchemaReady] = useState(true);
  const [recovery, setRecovery] = useState(false);
  const [pendingInvite, setPendingInvite] = useState("");
  const [invitationPreview, setInvitationPreview] = useState<InvitationPreview | null>(null);
  const [inviteChecked, setInviteChecked] = useState(false);
  const [teamNameDraft, setTeamNameDraft] = useState("");
  const preferredWorkspace = useRef<string | null>(null);
  const workspaceItems = allItems.filter(
    (i) => i.workspace_id === workspace?.id,
  );
  const projects = workspaceItems.filter((i) => i.kind === "project");
  const currentProject =
    projects.find((p) => p.id === projectId) || projects[0] || null;
  const items = workspaceItems.filter(
    (i) => i.kind !== "project" && i.project_id === currentProject?.id,
  );
  const projectScoped = ["map", "problemon", "goals", "input_metrics", "opportunities", "ideas", "experiments", "learning", "ai", ...mvpViews].includes(view);
  const availableKinds: Kind[] =
    view === "projects"
      ? ["project"]
      : view === "learning"
        ? ["learning"]
        : view === "experiments"
          ? ["experiment"]
          : view === "goals" || view === "input_metrics"
            ? ["goal"]
            : view === "opportunities"
              ? ["opportunity"]
              : view === "ideas"
                ? ["hypothesis"]
                : view === "map"
                  ? ["north_star", "goal", "opportunity", "hypothesis", "experiment"]
                  : [];
  const dialog = useRef<HTMLDialogElement>(null);
  const detail = useRef<HTMLDialogElement>(null);
  const loadVersion = useRef(0);
  const lastAutoRefresh = useRef(0);
  const role = publicMode
    ? "viewer"
    : demo
      ? "owner"
      : members.find((m) => m.user_id === user?.id)?.role;
  const editable = role === "owner" || role === "editor";
  const currentMember=members.find(m=>m.user_id===user?.id);
  const can=(kind:Kind,action:RecordAction)=>!publicMode&&(demo?editable:canRecord(currentMember,kind,action));
  const createKind=availableKinds.find(kind=>can(kind,'create'));
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("recovery")) setRecovery(true);
    setPendingInvite(params.get("invite") || "");
  }, []);
  useEffect(() => {
    setTeamNameDraft(workspace?.name || "");
  }, [workspace?.id, workspace?.name]);
  useEffect(() => {
    if (!supabase || !pendingInvite) {
      setInvitationPreview(null);
      setInviteChecked(!pendingInvite);
      return;
    }
    let active = true;
    setInviteChecked(false);
    void (async () => {
      try {
        const { data, error } = await supabase.rpc("get_invitation_preview", {
          invite_token: pendingInvite,
        });
        if (!active) return;
        if (error) {
          setInvitationPreview(null);
          setError(error.message);
        } else {
          setInvitationPreview((data || null) as InvitationPreview | null);
          setError("");
        }
      } finally {
        if (active) setInviteChecked(true);
      }
    })();
    return () => { active = false; };
  }, [pendingInvite]);
  const tell = (s: string) => {
    setToast(s);
    window.setTimeout(() => setToast(""), 5000);
  };
  const requestAuth = (mode: "login" | "signup" = "signup") => {
    setAuthMode(mode);
    setAuthRequested(true);
  };
  const author = (id: string | null) =>
    members.find((m) => m.user_id === id)?.name || "Miembro";
  useEffect(() => {
    if (!supabase) return;
    let live = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!live) return;
      if (error) setError(error.message);
      setUser(data.session?.user || null);
      // Si no hay sesión, mantenemos la pantalla de carga hasta resolver la vista pública.
      // Así evitamos mostrar el login durante un instante antes de abrir el sistema.
      if (data.session?.user) setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setUser(s?.user || null);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (demo) {
      setPublicMode(false);
      setWorkspace({ id: "demo", name: "Demostración" });
      setProfile({ name: demoMembers[0].name, avatar_url: null });
      setProfileReady(true);
      setDemoAttachments({});
      setDemoComments({});
      setItems(structuredClone(demoItems).map(normalizeExperiment));
      setMembers(demoMembers);
      setActivity(demoActivity);
      setLoading(false);
      return;
    }
    if (!user) {
      setWorkspaces([]);
      if (!supabase) return;
      if (pendingInvite) {
        setPublicMode(false);
        setWorkspace(null);
        setItems([]);
        setMembers([]);
        setActivity([]);
        setLoading(false);
        return;
      }
      let alive = true;
      setLoading(true);
      void getPublicPreview(supabase).then((preview) => {
        if (!alive) return;
        if (preview?.workspace) {
          // The home page opens Proyectos; direct links to other reader views remain shareable.
          const requestedSection = viewForPath(window.location.pathname);
          setView(requestedSection || "projects");
          if (window.location.pathname === "/" || !requestedSection) window.history.replaceState(window.history.state,"","/proyectos");
          setPublicMode(true);
          setWorkspace(preview.workspace);
          setItems((preview.records || []).map(normalizeExperiment));
          setMembers(preview.members || []);
          setActivity(preview.activity || []);
          setPublicAttachments(preview.attachments || []);
          setInvitations([]);
          setProfile({ name: "Vista pública", avatar_url: null });
          setProfileReady(true);
          setSchemaReady(true);
          setError("");
        } else {
          setPublicMode(false);
          setWorkspace(null);
          setItems([]);
          setMembers([]);
          setActivity([]);
          setPublicAttachments([]);
          setProfile({ name: "Miembro" });
          setProfileReady(false);
        }
      }).catch((err) => {
        if (!alive) return;
        setPublicMode(false);
        setWorkspace(null);
        setError(err instanceof Error ? err.message : "No se ha podido abrir la vista pública.");
      }).finally(() => {
        if (alive) setLoading(false);
      });
      return () => { alive = false; };
    }

    setPublicMode(false);
    setWorkspaces([]);
    setWorkspace(null);
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        if (pendingInvite) {
          const joined = await supabase!.rpc("join_workspace", { invite_token: pendingInvite });
          if (joined.error) throw new Error(joined.error.message);
          if (!joined.data) throw new Error("La invitación ya no es válida.");
          const joinedSpaces = await listTeamSpaces(supabase!);
          preferredWorkspace.current = joined.data as string;
          if (alive) {
            setWorkspaces(joinedSpaces);
            setWorkspace({ id: joined.data as string, name: invitationPreview?.team_name });
            setPendingInvite("");
            setInvitationPreview(null);
            window.history.replaceState({}, "", window.location.pathname);
            tell("Te has unido al equipo");
          }
          return;
        }

        // A new account without an invitation owns its own team automatically.
        // Users arriving by invitation are handled above and do not create a team.
        let spaces = await listTeamSpaces(supabase!);
        if (spaces.length === 0) {
          const created = await createPersonalTeamSpace(supabase!, user.user_metadata?.name);
          spaces = await listTeamSpaces(supabase!);
          if (!spaces.some((space) => space.id === created.id)) {
            spaces = [created, ...spaces];
          }
          preferredWorkspace.current = created.id;
        }
        let preferred: string | null = preferredWorkspace.current;
        preferredWorkspace.current = null;
        if (!preferred) { try { preferred = (localStorage.getItem(`xperiments.workspace.${user.id}`) || localStorage.getItem(`experimental-os.workspace.${user.id}`)); } catch {} }
        const space = selectTeamSpace(spaces, preferred);
        if (alive) { setWorkspaces(spaces); setWorkspace(space); setError(""); }
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "No se ha podido abrir el equipo.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.id, demo, pendingInvite]);
  useEffect(() => {
    if (!user || demo) return;
    let alive = true;
    setProfile({ name: user.user_metadata?.name || "Miembro" });
    setProfileReady(false);
    void supabase!.from("profiles").select("*").eq("id", user.id).single().then(({ data, error }) => {
      if (!alive) return;
      if (error) { setError(error.message); return; }
      setProfile({ name: data.name, avatar_url: data.avatar_url || null });
      setProfileReady(Object.prototype.hasOwnProperty.call(data, "avatar_url"));
    });
    return () => { alive = false; };
  }, [user?.id, demo]);
  useEffect(() => {
    if (user && !demo) void cleanupAttachments().catch(() => {});
  }, [user?.id, demo]);
  async function load(w = workspace) {
    if (!w || demo) return;
    if (publicMode) {
      setLoading(true);
      try {
        const preview = await getPublicPreview(supabase!);
        if (preview?.workspace) {
          setWorkspace(preview.workspace);
          setItems((preview.records || []).map(normalizeExperiment));
          setMembers(preview.members || []);
          setActivity(preview.activity || []);
          setPublicAttachments(preview.attachments || []);
          setError("");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se ha podido actualizar la vista pública.");
      }
      setLoading(false);
      return;
    }
    const version = ++loadVersion.current;
    setLoading(true);
    const r = await Promise.all([
      loadWorkspaceRecords(supabase!, w.id).then(data => ({ data, error: null }), error => ({ data: null, error: { message: error.message } })),
      supabase!
        .from("members")
        .select("user_id,role,permissions,profiles(*)")
        .eq("workspace_id", w.id),
      supabase!
        .from("audit_log")
        .select("id,actor_id,actor_name,action,record_id,title,created_at")
        .eq("workspace_id", w.id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase!
        .from("invitations")
        .select("id,token,role,expires_at,used_by")
        .eq("workspace_id", w.id),
      supabase!
        .from("workspaces")
        .select("id,name")
        .eq("id", w.id)
        .single(),
    ]);
    if (version !== loadVersion.current) return;
    // Los permisos del equipo no dependen de la carga de sus registros.
    if (!r[1].error) setMembers(
      (r[1].data || []).map((m: any) => ({
        user_id: m.user_id, role: m.role, permissions:m.permissions,
        name: m.profiles?.name || "Miembro", avatar_url: m.profiles?.avatar_url || null,
      })),
    );
    const err = r.find((x) => x.error)?.error;
    if (err) {
      setError(err.message);
    } else {
      const loaded = (r[0].data || []) as Item[];
      const ready = loaded.length
        ? loaded.every((item) =>
            Object.prototype.hasOwnProperty.call(item, "project_id"),
          )
        : !(await supabase!.from("records").select("project_id").limit(0))
            .error;
      setSchemaReady(ready);
      const defaultProject = loaded
        .filter((item) => item.kind === "project")
        .sort(
          (a, b) =>
            a.created_at.localeCompare(b.created_at) ||
            a.id.localeCompare(b.id),
        )[0];
      setItems(
        loaded.map((item) =>
          normalizeExperiment(
            ready
              ? item
              : {
                  ...item,
                  project_id:
                    item.kind === "project" ? null : defaultProject?.id || null,
                },
          ),
        ),
      );
      setActivity(r[2].data || []);
      setInvitations(r[3].data || []);
      if (r[4].data) setWorkspace({ id: r[4].data.id, name: r[4].data.name });
      setError("");
    }
    setLoading(false);
  }
  useEffect(() => {
    if (!demo) {
      ++loadVersion.current;
      setMembers([]); setItems([]); setActivity([]); setInvitations([]); setInviteUrl("");
      setSelected(null); setDraft(null); setProjectId(""); setPublicAttachments([]);
      setRecordComments([]); setSelectedHistory([]); setFilter("");
      if (workspace) void load(workspace);
    }
  }, [workspace?.id, demo]);
  // The tree can change from an external agent or another browser session.
  // Fetch fresh records when returning to this tab instead of keeping an old snapshot.
  useEffect(() => {
    if (demo || !workspace) return;
    const refreshOnReturn = () => {
      if (document.visibilityState !== "visible" || draft || saving) return;
      const now = Date.now();
      if (now - lastAutoRefresh.current < 2000) return;
      lastAutoRefresh.current = now;
      void load(workspace);
    };
    window.addEventListener("focus", refreshOnReturn);
    document.addEventListener("visibilitychange", refreshOnReturn);
    return () => {
      window.removeEventListener("focus", refreshOnReturn);
      document.removeEventListener("visibilitychange", refreshOnReturn);
    };
  }, [workspace?.id, demo, draft, saving, publicMode]);
  useEffect(() => {
    if (draft) {
      dialog.current?.showModal();
    } else dialog.current?.close();
  }, [draft]);
  useEffect(() => {
    if (selected) detail.current?.showModal();
    else detail.current?.close();
  }, [selected]);
  useEffect(() => {
    setCommentText("");
    setSelectedHistory([]);
    setRecordComments([]);
    if (!selected || !["goal", "opportunity", "hypothesis", "research", "experiment"].includes(selected.kind) || publicMode) return;
    if (demo) {
      setSelectedHistory(activity.filter((entry) => entry.record_id === selected.id));
      setRecordComments(demoComments[selected.id] || []);
      return;
    }
    if (!supabase) return;
    let active = true;
    void Promise.all([
      supabase
        .from("audit_log")
        .select("id,actor_id,actor_name,action,record_id,title,created_at")
        .eq("workspace_id", selected.workspace_id)
        .eq("record_id", selected.id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("record_comments")
        .select("id,workspace_id,record_id,author_id,author_name,body,created_at")
        .eq("workspace_id", selected.workspace_id)
        .eq("record_id", selected.id)
        .order("created_at", { ascending: false })
        .limit(100),
    ]).then(([historyResult, commentsResult]) => {
      if (!active) return;
      if (!historyResult.error) setSelectedHistory((historyResult.data || []) as Activity[]);
      if (!commentsResult.error) setRecordComments((commentsResult.data || []) as RecordComment[]);
      else setError(commentsResult.error.message);
    });
    return () => {
      active = false;
    };
  }, [selected?.id, selected?.kind, demo, publicMode]);
  async function addRecordComment() {
    if (!selected || !commentText.trim() || commentBusy || publicMode) return;
    const body = commentText.trim();
    setCommentBusy(true);
    if (demo) {
      const comment: RecordComment = {
          id: crypto.randomUUID(),
          workspace_id: selected.workspace_id,
          record_id: selected.id,
          author_id: "demo-user",
          author_name: profile.name,
          body,
          created_at: new Date().toISOString(),
        };
      setDemoComments(prev => ({ ...prev, [selected.id]: [comment, ...(prev[selected.id] || [])] }));
      setRecordComments(prev => [comment, ...prev]);
      setCommentText("");
      setCommentBusy(false);
      return;
    }
    if (!supabase || !user) {
      setCommentBusy(false);
      return;
    }
    const result = await supabase
      .from("record_comments")
      .insert({
        workspace_id: selected.workspace_id,
        record_id: selected.id,
        author_id: user.id,
        author_name: profile.name,
        body,
      })
      .select("id,workspace_id,record_id,author_id,author_name,body,created_at")
      .single();
    if (result.error) {
      setError(result.error.message);
    } else if (result.data) {
      setRecordComments((prev) => [result.data as RecordComment, ...prev]);
      setCommentText("");
    }
    setCommentBusy(false);
  }
  function create(kind: Kind, parent_id: string | null = null, goiSection?: "objectives" | "input_metrics", hypothesisId?: string | null, researchTargetId?: string | null, markProblemon=false) {
    if(!can(kind,'create')){tell('No tienes permiso para crear este tipo de ficha.');return;}
    if (!workspace) return;
    if (!demo && !schemaReady) {
      tell(
        "La organización por proyectos requiere completar la actualización de Supabase indicada en el repositorio.",
      );
      return;
    }
    if (kind !== "project" && !currentProject) {
      tell("Crea o selecciona un proyecto primero.");
      return;
    }
    if (kind === "north_star" && items.some((i) => i.kind === "north_star")) {
      tell(
        "Edita la North Star existente: cada proyecto tiene una métrica principal.",
      );
      return;
    }

    let resolvedParentId = parent_id;
    if (kind === "goal") {
      const storedNorthStar = items.find((i) => i.kind === "north_star");
      const projectNorthStar = String(currentProject?.fields.north_star || "").trim();
      if (!storedNorthStar && !projectNorthStar) {
        tell("Define primero la North Star Metric del proyecto antes de crear un objetivo.");
        return;
      }
      // Objetivos and Input Metrics are separate direct children of North Star Metric.
      // Never create an Input Metric (or an Objetivo) under another Objetivo.
      resolvedParentId = goalParent(resolvedParentId, items);
    }

    if(kind==="hypothesis" && !resolvedParentId && currentProject) resolvedParentId=getProblemon(items,currentProject.id)?.id||null;
    if(kind==="experiment" && !resolvedParentId && !hypothesisId)
      resolvedParentId=items.find(item=>item.kind==="hypothesis"&&item.fields.is_main_hypothesis===true)?.id||null;

    setError("");
    const defaults = Object.fromEntries(
      schemas[kind]
        .filter((f) => f.type === "select")
        .map((f) => [f.key, f.options?.[0] || ""]),
    );
    const parent = items.find((item) => item.id === resolvedParentId);
    // Never inherit free-text fields from parent records automatically.
    // A linked parent defines the relationship, not consent to copy its text.
    // Only typed input or a user-requested, explicitly applied AI proposal may fill it.
    setDraft({
      id: crypto.randomUUID(),
      workspace_id: workspace.id,
      project_id: kind === "project" ? null : currentProject!.id,
      kind,
      parent_id: kind === "experiment" && hypothesisId ? hypothesisId : resolvedParentId,
      related_id: null,
      title: "",
      owner_id: null,
      fields: {
        ...defaults,
        ...(kind === "goal"
          ? { goi_section: goiSection || (view === "input_metrics" ? "input_metrics" : "objectives") }
          : {}),
        ...(kind === "opportunity" && (mvpViews as readonly string[]).includes(view) ? { opportunity_type: "Problema" } : {}),
        ...(kind === "opportunity" && markProblemon ? { is_problemon: true } : {}),
        ...(kind === "research" && researchTargetId ? { mvp_links: researchTargetId } : {}),
        ...(kind === "hypothesis" && view==="mvp_main_hypothesis" ? {is_main_hypothesis:true}: {}),
        ...(kind === "experiment" && (hypothesisId || (resolvedParentId && parent?.kind === "hypothesis")) ? { mvp_hypothesis_id: hypothesisId || resolvedParentId! } : {}),
        ...(kind === "experiment"
          ? {
              impact: 5,
              confidence: 5,
              ease: 5,
            }
          : kind === "hypothesis"
            ? { impact: 5, confidence: 5, ease: 5 }
            : {}),
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: user?.id || null,
      updated_by: user?.id || null,
    });
  }
  function createMvp(kind: Kind, parent: string | null = null) {
    setMvpEditor(kind !== "experiment");
    // Research uses a many-to-many link, never GOI's parent_id. Experiments
    // both trees share the same hypothesis parent.
    create(kind, kind === "research" ? null : parent,
      undefined, kind === "experiment" ? parent : null, kind === "research" ? parent : null);
  }
  function createProblemon() {
    if (currentProject && getProblemon(items,currentProject.id)) {
      tell("Este proyecto ya tiene un Problema principal. Edita el actual o quita su designación.");
      return;
    }
    setMvpEditor(true);
    create("opportunity",null,undefined,null,null,true);
  }
  function designateProblemon(item: Item) {
    if (!can("opportunity","edit") || !currentProject || item.project_id!==currentProject.id) return;
    if (getProblemon(items,currentProject.id)) {
      tell("Ya hay un Problema principal. Desmarca primero el actual para elegir otro.");
      return;
    }
    setMvpEditor(true);
    setDraft({...structuredClone(item),fields:{...item.fields,is_problemon:true}});
    setSelected(null);
    setError("");
  }
  function renderProblemon(compact=false) {
    if (!currentProject) return null;
    return <ProblemonSection
      key={currentProject.id + ":" + (compact?"summary":"section")}
      compact={compact} project={currentProject} items={items}
      readOnly={publicMode || (!demo && !editable)}
      canCreate={can("opportunity","create")} canEdit={can("opportunity","edit")}
      onCreate={createProblemon} onDesignate={designateProblemon}
      onOpen={openMvp} onEdit={editMvp}
    />;
  }
  function editMvp(record: Item) {
    setMvpEditor(record.kind !== "experiment");
    setDraft(structuredClone(record));
    setSelected(null);
    setError("");
  }
  function openMvp(record: Item) {
    setMvpEditor(record.kind !== "experiment");
    setSelected(record);
  }
  function openAIProposal(proposal:Preparation){
    if(!workspace||!currentProject||!can('experiment','create')||(!demo&&!schemaReady))return;
    setError('');setDraftFiles([]);navigateView('experiments');
    setDraft({id:crypto.randomUUID(),workspace_id:workspace.id,project_id:currentProject.id,kind:'experiment',parent_id:null,related_id:null,title:proposal.title,owner_id:user?.id||null,
      fields:{impact:5,confidence:5,ease:5,...applyPreparation({},proposal)},created_at:new Date().toISOString(),updated_at:new Date().toISOString(),created_by:user?.id||null,updated_by:user?.id||null});
  }
  async function save(prepareMeta=false,prepareGoogle=false,preparePosthog=false) {
    if (!draft || saving || attachmentsBusy || assistantBusy) return;
    if(!can(draft.kind,allItems.some(i=>i.id===draft.id)?'edit':'create')){setError('No tienes permiso para guardar esta ficha.');return;}
    if (!demo && !schemaReady) {
      setError(
        "Completa primero la actualización de Supabase indicada en el repositorio.",
      );
      return;
    }
    let record = normalizeExperiment(draft);
    // Keep the chosen GOI section when editing from the tree or another view.
    // Only a newly created goal without a category defaults to "objectives".
    if (record.kind === "goal" && !record.fields.goi_section) {
      record = { ...record, fields: { ...record.fields, goi_section: "objectives" } };
    }
    const problem = validate(record);
    if (record.kind==="opportunity" && isProblemon(record) &&
        items.some(item=>item.id!==record.id && isProblemon(item))) {
      setError("Este proyecto ya tiene un Problema principal. Solo se permite uno por proyecto.");
      return;
    }
    if (record.kind==="hypothesis" && record.fields.is_main_hypothesis===true &&
        items.some(item=>item.kind==="hypothesis"&&item.id!==record.id&&item.fields.is_main_hypothesis===true)) {
      setError("Ya hay una hipótesis principal. Desmarca la actual antes de designar otra.");
      return;
    }
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    try {
    setError("");
    const exists = allItems.some((i) => i.id === draft.id);
    if (
      draft.kind === "opportunity" &&
      draft.fields.focus &&
      items.filter(
        (i) => i.kind === "opportunity" && i.fields.focus && i.id !== draft.id,
      ).length >= 5
    ) {
      setError("Selecciona un máximo de 5 oportunidades prioritarias.");
      setSaving(false);
      return;
    }
    let addedNorthStar: Item | null = null;
    if (record.kind === "goal" && !record.parent_id && currentProject) {
      try {
        addedNorthStar = demo ? projectNorthStarRecord(currentProject) : await ensureProjectNorthStar(supabase!, currentProject);
        record = { ...record, parent_id: addedNorthStar.id };
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo guardar la North Star del proyecto.");
        setSaving(false);
        return;
      }
    }
    if (demo) {
      setItems((prev) =>
        exists
          ? prev.map((i) => (i.id === record.id ? record : i))
          : [...prev, ...(addedNorthStar ? [addedNorthStar] : []), record],
      );
      setActivity((prev) => [
        {
          id: crypto.randomUUID(),
          actor_id: "demo-user",
          action: exists ? "update" : "insert",
          record_id: draft.id,
          title: draft.title,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      if (record.kind === "project") {
        setProjectId(record.id);
        navigateView("map");
      }
      setDraft(null);
      if (supportsAttachments(record.kind)) setSelected(record);
      tell("Guardado en esta sesión de demostración");
      setSaving(false);
      return;
    }
    const payload = {
      title: draft.title,
      owner_id: draft.owner_id,
      parent_id: record.parent_id,
      related_id: draft.related_id,
      fields: record.fields,
      project_id: record.project_id,
    };
    const q = record.kind==='experiment' ? supabase!.rpc('save_experiment_preparation',{p_record:{...payload,id:record.id,workspace_id:record.workspace_id},p_expected:exists?record.updated_at:null}) : exists
      ? supabase!
          .from("records")
          .update(payload)
          .eq("id", draft.id)
          .eq("updated_at", draft.updated_at)
          .select()
      : supabase!
          .from("records")
          .insert({
            ...payload,
            id: draft.id,
            workspace_id: draft.workspace_id,
            kind: draft.kind,
          })
          .select();
    const r = await q;
    if (r.error) {
      setError(r.error.code==="23505" && r.error.message.includes("one_problemon_per_project")
        ? "Este proyecto ya tiene un Problema principal. Desmarca su designación antes de elegir otro."
        : r.error.message);
    } else if (!r.data?.length) {
      setError(
        "Otra persona ha modificado este registro. Cierra el formulario y actualiza antes de editar.",
      );
    } else {
      if(record.kind==='experiment' && draftFiles.length){
        const remaining=[...draftFiles];
        try{
          while(remaining.length){await addFileAttachment(record.id,record.workspace_id,remaining[0]);remaining.shift();setDraftFiles([...remaining]);}
        }catch(err){
          await load();setDraft(normalizeExperiment(r.data[0] as Item));setError(`La ficha se guardó, pero faltan archivos: ${err instanceof Error?err.message:'Error de subida'}. Puedes volver a guardar para reintentar.`);setSaving(false);return;
        }
      }
      if (record.kind === "project") {
        setProjectId(record.id);
        navigateView("map");
      }
      setDraft(null);
      tell("Cambios guardados");
      await load();
      setMetaPreparationTarget(prepareMeta&&record.kind==='experiment'&&record.fields.channel==='meta_ads'?record.id:null);
      setGooglePreparationTarget(prepareGoogle&&record.kind==='experiment'&&record.fields.channel==='google_ads'?record.id:null);
      setPosthogPreparationTarget(preparePosthog&&record.kind==='experiment'&&posthogChannels.includes(String(record.fields.channel))?record.id:null);
      if (supportsAttachments(record.kind)) setSelected(normalizeExperiment(r.data[0] as Item));
    }
    } catch {
      setError("No se pudo terminar el guardado. Conserva esta ficha y actualiza los datos antes de volver a intentarlo.");
    } finally {
      setSaving(false);
    }
  }
  async function deleteRecord(record: Item) {
    if (!can(record.kind,'delete') || demo || publicMode) return;
    const label = kinds[record.kind].toLocaleLowerCase("es");
    const childrenToPreserve = workspaceItems.filter(item => item.parent_id === record.id).length;
    const extra = record.kind === "project"
      ? " También se eliminarán todos sus registros asociados."
      : childrenToPreserve
        ? ` Se conservarán ${childrenToPreserve} hijos sin padre en sus proyectos. Podrás reasignarlos después.`
        : "";
    if (!window.confirm(`¿Eliminar el ${label} «${record.title}»?${extra} Esta acción no se puede deshacer.`)) return;
    setError("");
    try {
      await deleteWorkspaceRecord(supabase!, record);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido eliminar la ficha.");
      return;
    }
    // Failed cleanup stays in the existing queue and is retried on the next session.
    void cleanupAttachments().catch(() => {});
    setSelected(null);
    if (record.kind === "project" && projectId === record.id) setProjectId("");
    tell("Eliminado correctamente");
    await load();
  }

  async function exportData(format: BackupFormat, originals: boolean, progress: (message: string) => void) {
    if (!workspace) throw new Error("Abre el equipo antes de exportar.");
    // CSV is a strict 4-column list; don't fetch the full private backup
    // or allow a ZIP with additional JSON or attachments on this route.
    if (format === "csv") {
      const records = demo ? structuredClone(workspaceItems) : await fetchCsvRecords(supabase!, workspace.id);
      const { downloadBackup } = await import("@/lib/backup-download");
      const snapshot: Backup = {
        schema_version: 8, exported_at: new Date().toISOString(), workspace_id: workspace.id,
        records, members: [], attachments: [], audit: [], notes: [],
      };
      await downloadBackup(snapshot, "csv", false, async () => {
        throw new Error("La exportación CSV no incluye archivos adjuntos.");
      }, progress);
      tell("Listado CSV de cuatro columnas descargado");
      return;
    }
    const snapshot: Backup = demo ? {
      schema_version: 4, exported_at: new Date().toISOString(), workspace_id: workspace.id,
      records: structuredClone(workspaceItems), members: structuredClone(members), audit: structuredClone(activity) as unknown as Record<string, unknown>[],
      attachments: workspaceItems.flatMap(record => demoAttachments[record.id] || []).map(({ preview_url, ...attachment }) => attachment),
      comments: Object.values(demoComments).flat() as unknown as Record<string, unknown>[],
      notes: ["Demostración: datos ficticios de esta sesión."],
    } : await fetchBackup(supabase!, workspace.id);
    const { downloadBackup } = await import("@/lib/backup-download");
    await downloadBackup(snapshot, format, originals, async attachment => {
      if (demo) {
        const original = Object.values(demoAttachments).flat().find(a => a.id === attachment.id);
        if (!original?.preview_url) throw new Error("No se conserva el archivo original «" + attachment.name + "» en esta sesión.");
        const response = await fetch(original.preview_url);
        if (!response.ok) throw new Error("No se ha podido descargar «" + attachment.name + "».");
        return new Uint8Array(await response.arrayBuffer());
      }
      if (!attachment.storage_path) throw new Error("Falta la ruta del archivo «" + attachment.name + "».");
      const downloaded = await supabase!.storage.from(attachmentBucket).download(attachment.storage_path);
      if (downloaded.error || !downloaded.data) throw new Error("No se ha podido descargar «" + attachment.name + "». " + (downloaded.error?.message || ""));
      return new Uint8Array(await downloaded.data.arrayBuffer());
    }, progress,async document=>{
      const result=await supabase!.storage.from('ai-documents').download(String(document.storage_path));
      if(result.error||!result.data)throw new Error('No se pudo descargar el original de memoria «'+document.name+'».');
      return new Uint8Array(await result.data.arrayBuffer());
    });
    tell("Copia completa descargada");
  }
  const experiments = items.filter((i) => i.kind === "experiment");
  // Distinct MVP records in the currently selected project; shared problems
  // and experiments count once even though both trees display them.
  const mvpTreeCount = items.filter(i =>
    ["opportunity", "hypothesis", "research", "experiment"].includes(i.kind)
  ).length;
  const northStarDescription =
    "Métrica que mide al mismo tiempo el valor que recibe el usuario y nuestra capacidad para monetizar.";
  function northStarForProject(project: Item) {
    const stored = workspaceItems.find(
      (i) => i.kind === "north_star" && i.project_id === project.id,
    );
    const projectMetric = String(project.fields.north_star || "").trim();
    if (stored) return stored;
    if (!projectMetric) return undefined;
    return {
      id: `project-north-star-${project.id}`,
      workspace_id: project.workspace_id,
      project_id: project.id,
      kind: "north_star" as Kind,
      parent_id: null,
      related_id: null,
      title: projectMetric,
      owner_id: project.owner_id,
      fields: {
        definition: northStarDescription,
        metric: projectMetric,
        source: project.fields.analytics_url || project.fields.posthog_host || "",
        frequency: "",
      },
      created_at: project.created_at,
      updated_at: project.updated_at,
      created_by: project.created_by,
      updated_by: project.updated_by,
    } as Item;
  }
  function renderNorthStarBanner(project: Item, compact = false) {
    const metric = northStarForProject(project);
    if (!metric) {
      return (
        <div className={"north-star north-star-empty" + (compact ? " compact" : "")}>
          <div className="north-icon"><Compass size={compact ? 20 : 28} /></div>
          <div className="north-content">
            <span>NORTH STAR METRIC</span>
            <h2>Sin definir</h2>
            <p>{northStarDescription}</p>
          </div>
        </div>
      );
    }
    const stored = metric.id.startsWith("project-north-star-") ? null : metric;
    return (
      <button
        className={"north-star" + (compact ? " compact" : "")}
        onClick={() => setSelected(stored || project)}
      >
        <div className="north-icon"><Compass size={compact ? 20 : 28} /></div>
        <div className="north-content">
          <span>NORTH STAR METRIC</span>
          <h2>{metric.title}</h2>
          <p>{northStarDescription}</p>
          {!compact && (
            <span className="north-source">
              {metric.fields.frequency} · {metric.fields.source}
            </span>
          )}
        </div>
        {!compact && (
          <div className="north-value">
            <strong>
              {metric.fields.current ?? "—"}
              <small> / {metric.fields.target ?? "—"}</small>
            </strong>
            <span>
              {metric.fields.unit} · {progress(metric.fields)}% del recorrido
            </span>
            <Meter value={progress(metric.fields)} />
          </div>
        )}
      </button>
    );
  }
  const storedNsm = items.find((i) => i.kind === "north_star");
  const projectNorthStar = String(currentProject?.fields.north_star || "").trim();
  const nsm = storedNsm || (currentProject && projectNorthStar ? {
    id: `project-north-star-${currentProject.id}`,
    workspace_id: currentProject.workspace_id,
    project_id: currentProject.id,
    kind: "north_star" as Kind,
    parent_id: null,
    related_id: null,
    title: projectNorthStar,
    owner_id: currentProject.owner_id,
    fields: {
      definition: northStarDescription,
      metric: projectNorthStar,
      source: currentProject.fields.analytics_url || currentProject.fields.posthog_host || "",
      frequency: "",
    },
    created_at: currentProject.created_at,
    updated_at: currentProject.updated_at,
    created_by: currentProject.created_by,
    updated_by: currentProject.updated_by,
  } as Item : undefined);
  const goals = items.filter((i) => i.kind === "goal");
  const visibleExperiments = experiments.filter((i) =>
    [
      i.title,
      i.fields.hypothesis,
      i.fields.context,
      i.fields.tags,
      author(i.owner_id),
    ]
      .join(" ")
      .toLowerCase()
      .includes(filter.toLowerCase()),
  );
  function parentTag(item: Item) {
    if (!["opportunity", "hypothesis", "experiment"].includes(item.kind)) return null;
    const parent = items.find((record) => record.id === item.parent_id);
    if (!parent) return null;
    const parentGoal = parent.kind === "goal";
    const parentOpportunity = parent.kind === "opportunity";
    const parentStyle = parentGoal ? goalVisualClass(parent) : parentOpportunity ? "opportunity" : parent.kind === "hypothesis" ? "hypothesis" : "";
    return (
      <span
        className={`record-parent-pill ${parentStyle}`.trim()}
        title={parent.title}
      >
        {parentGoal ? (
          <GoalTypeIcon item={parent} size={17} />
        ) : parentOpportunity ? (
          isProblemon(parent) ? <Flag size={17} color="var(--red-text)" aria-hidden="true" /> : <Search size={17} color="var(--red-text)" aria-hidden="true" />
        ) : parent.kind === "hypothesis" ? (
          <Lightbulb size={17} aria-hidden="true" />
        ) : (
          <ChevronRight size={17} aria-hidden="true" />
        )}
        <span className="record-parent-name">{parent.title}</span>
      </span>
    );
  }

  function experimentTag(experiment: Item) {
    return <span className="experiment-identity" title={experiment.title}><FlaskConical size={15} aria-hidden="true"/><span>{experiment.title}</span></span>;
  }

  function goiTitleTag(i: Item) {
    const visual = i.kind === "goal" ? goalVisualClass(i) : i.kind;
    const I = i.kind === "goal" ? null : i.kind === "opportunity" ? (isProblemon(i) ? Flag : Search) : Lightbulb;
    return <span className={`goi-title-tag ${visual}`} title={i.title}>
      {i.kind === "goal" ? <GoalTypeIcon item={i} size={17}/> : I ? <I size={17} aria-hidden="true"/> : null}
      <span>{i.title}</span>
    </span>;
  }

  function itemCard(i: Item, inHierarchy = false) {
    return (
      <button className="record-card" key={i.id} onClick={() => setSelected(i)}>
        {["goal","opportunity","hypothesis"].includes(i.kind) ? (
          <div className="row goi-title-row">
            {goiTitleTag(i)}
            
            {i.kind === "opportunity" && i.fields.focus && <span className="focus">Prioritaria</span>}
          </div>
        ) : (
          <>
            {i.kind !== "experiment" && <span className={"kind " + i.kind}><IconFor kind={i.kind}/>{kinds[i.kind]}</span>}
            {i.kind === "experiment" ? experimentTag(i) : <strong>{i.title}</strong>}
          </>
        )}
        {!inHierarchy && parentTag(i)}
        {inHierarchy && i.kind==="opportunity" && ["impact","confidence","ease"].some(key=>i.fields[key]!==undefined) && <span className="small hierarchy-ice">ICE {score(i.fields)}</span>}
        {i.kind === "goal" && i.fields.goi_section === "input_metrics" && <span className="small">Actual: {i.fields.current ?? "—"} · Meta: {i.fields.target ?? "—"} {i.fields.unit || ""}</span>}
        {["goal", "opportunity", "hypothesis"].includes(i.kind) && i.owner_id && (
          <span className="small record-owner">Responsable: {author(i.owner_id)}</span>
        )}
        {i.kind === "kr" && (
          <>
            <div className="row small">
              <span>
                {i.fields.current ?? "—"} / {i.fields.target ?? "—"}{" "}
                {i.fields.unit}
              </span>
              <span>{progress(i.fields)}%</span>
            </div>
            <Meter value={progress(i.fields)} />
          </>
        )}
        {i.kind === "hypothesis" && (
          <>
            <span className="small">
              ICE {score(i.fields)} ·{" "}
              {items.filter((x) => x.parent_id === i.id && x.kind === "experiment").length} experimentos
            </span>
            {!inHierarchy && items.some(x => x.parent_id === i.id && x.kind === "experiment") && (
              <span className="hypothesis-experiment-tags">
                {items.filter(x => x.parent_id === i.id && x.kind === "experiment").map(x=><span className="hypothesis-experiment-chip" key={x.id}><FlaskConical size={15} aria-hidden="true"/><span>{x.title}</span></span>)}
              </span>
            )}
          </>
        )}
        {i.kind === "experiment" && (
          <div className="row">
            {i.owner_id && <span className="small">{author(i.owner_id)}</span>}
            <span className="small">ICE {score(i.fields)}</span>
          </div>
        )}
      </button>
    );
  }
  function branch(i: Item) {
    const children = items
      .filter((x) => x.parent_id === i.id && x.kind !== "learning")
      .sort((a, b) => score(b.fields) - score(a.fields));
    return (
      <div className={"tree-branch " + i.kind} key={i.id}>
        {itemCard(i, true)}
        {children.length > 0 && (
          <details>
            <summary>
              <ChevronRight size={14} />
              {children.length} elementos
            </summary>
            <div className="branch-children">{children.map(branch)}</div>
          </details>
        )}
        {can(i.kind==='goal'?'opportunity':i.kind==='opportunity'?'hypothesis':'experiment','create') && ["goal", "opportunity", "hypothesis"].includes(i.kind) && (
          <button
            className="add-node"
            onClick={() =>
              create(
                i.kind === "goal"
                  ? "opportunity"
                  : i.kind === "opportunity"
                    ? "hypothesis"
                    : "experiment",
                i.id,
              )
            }
          >
            <Plus size={14} />
            {i.kind === "goal"
              ? "Añadir oportunidad"
              : i.kind === "opportunity"
                ? "Añadir hipótesis"
                : "Diseñar experimento"}
          </button>
        )}
      </div>
    );
  }
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool || !workspace) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: "read_growth_workspace",
            title: "Consultar el Growth Tree del proyecto",
            description:
              "Lee los registros visibles del proyecto seleccionado, con North Star, Growth Tree, experimentos y aprendizajes.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            execute: (input: unknown) => {
              if (
                !input ||
                typeof input !== "object" ||
                Object.keys(input).length
              )
                throw new Error("Se esperaba un objeto vacío");
              return { workspace, project: currentProject, records: items };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, [workspace, items, currentProject]);
  async function saveProfile(next: PersonalProfile) {
    if (!demo) {
      const r = await supabase!.rpc("update_my_profile", { profile_name: next.name, photo: next.avatar_url });
      if (r.error) throw new Error(r.error.message);
    }
    setProfile(next);
    setMembers(prev => prev.map(member => member.user_id === (demo ? "demo-user" : user?.id) ? { ...member, ...next } : member));
    tell("Perfil actualizado");
  }
  const draftFields = (links?: ReactNode) => draft && (draft.kind === "experiment" ? schemas.experiment : mvpEditor && mvpSchemas[draft.kind] ? mvpSchemas[draft.kind]! : schemas[draft.kind]).filter(f => draft.kind !== "experiment" || f.key !== "posthog_experiment_id").map((f) => (
                <Fragment key={f.key}>
                {draft.kind === "experiment" && f.key === "impact" && <h3 className="full experiment-ice-title">ICE</h3>}
                {draft.kind === "hypothesis" && f.key === "description" && <h3 className="full hypothesis-form-section">Planteamiento</h3>}
                {draft.kind === "hypothesis" && f.key === "belief" && <h3 className="full hypothesis-form-section">Hipótesis y fundamentos</h3>}
                {draft.kind === "hypothesis" && f.key === "validation_need" && <h3 className="full hypothesis-form-section">Validación</h3>}
                {draft.kind === "hypothesis" && f.key === "metric" && <h3 className="full hypothesis-form-section">Indicadores y priorización</h3>}
                <label
                  key={f.key}
                  className={
                    f.type === "textarea"
                      ? "full"
                      : f.type === "checkbox"
                        ? "check-label full"
                        : ""
                  }
                >
                  {f.type === "checkbox" ? (
                    <>
                      <input
                        type="checkbox"
                        checked={!!draft.fields[f.key]}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            fields: {
                              ...draft.fields,
                              [f.key]: e.target.checked,
                            },
                          })
                        }
                      />
                      {f.label}
                    </>
                  ) : (
                    <>
                      {f.label}
                      {f.type === "textarea" ? (
                        <textarea
                          required={f.required && !(draft.kind==="opportunity" && isProblemon(draft) && f.key==="evidence")}
                          rows={3}
                          value={String(draft.fields[f.key] ?? "")}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              fields: {
                                ...draft.fields,
                                [f.key]: e.target.value,
                              },
                            })
                          }
                        />
                      ) : f.type === "select" ? (
                        <select
                          value={String(
                            draft.fields[f.key] ?? f.options?.[0] ?? "",
                          )}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              fields: {
                                ...draft.fields,
                                [f.key]: e.target.value,
                              },
                            })
                          }
                        >
                          {f.options?.map((s) => (
                            <option key={s} value={s}>
                              {s || "Pendiente"}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={f.type || "text"}
                          required={f.required}
                          step={f.type === "number" ? "any" : undefined}
                          min={
                            ["impact", "confidence", "ease"].includes(f.key)
                              ? 1
                              : undefined
                          }
                          max={
                            ["impact", "confidence", "ease"].includes(f.key)
                              ? 10
                              : undefined
                          }
                          value={String(draft.fields[f.key] ?? "")}
                          onChange={(e) => {
                            const fields = { ...draft.fields };
                            if (f.type === "number" && e.target.value === "")
                              delete fields[f.key];
                            else
                              fields[f.key] =
                                f.type === "number"
                                  ? Number(e.target.value)
                                  : e.target.value;
                            setDraft({ ...draft, fields });
                          }}
                        />
                      )}
                    </>
                  )}
                </label>
                {draft.kind === "experiment" && f.key === "tags" && <><div className="full">{links}</div><ExperimentExecution draft={draft} disabled={saving||assistantBusy} onChange={setDraft}/>{!publicMode && <ExperimentAssistant key={`${draft.id}-${String(draft.fields.channel||'')}`} draft={draft} files={draftFiles} onFiles={setDraftFiles} allowAttachments={can('experiment','edit')} disabled={saving || attachmentsBusy} demo={demo} onApply={setDraft} onBusy={setAssistantBusy}/>}</>}
                </Fragment>
              ));
  const profileEditor = showProfile ? <ProfileDialog profile={profile} ready={profileReady} onSave={saveProfile} onClose={() => setShowProfile(false)} /> : null;
  if (pendingInvite && !user && !demo && !inviteChecked)
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <BrandIdentity />
          <h1>Comprobando invitación…</h1>
        </div>
      </div>
    );
  if (pendingInvite && !user && !demo && inviteChecked && invitationPreview)
    return (
      <Auth
        initialMode="signup"
        invitation={invitationPreview}
        onDemo={() => {}}
        onMessage={tell}
        onAuthenticated={(nextUser) => setUser(nextUser)}
      />
    );
  if (pendingInvite && !user && !demo && inviteChecked && !invitationPreview)
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <BrandIdentity />
          <span className="eyebrow">INVITACIÓN</span>
          <h1>Esta invitación ya no es válida</h1>
          <p>Puede haber caducado, haber sido utilizada o haber sido revocada.</p>
          <button className="btn primary" onClick={() => {
            setPendingInvite("");
            setError("");
            window.history.replaceState({}, "", window.location.pathname);
          }}>Ir a Xperiments</button>
        </div>
      </div>
    );
  if (loading && !workspace)
    return (
      <div className="auth-shell">
        <div className="auth-card guest-loader-card" role="status" aria-live="polite">
          <div className="guest-loader-brand">
            <div className="guest-logo-wrap">
              <img
                className="xperiments-logo guest-logo"
                src="/logo.svg"
                width={695}
                height={258}
                alt="Xperiments"
              />
              <span className="lab-bubbles" aria-hidden="true">
                <i /><i /><i />
              </span>
            </div>
          </div>
          <h1>Preparando laboratorio digital…</h1>
          <p className="guest-loader-text">
            Estamos encendiendo tu entorno de experimentación.
          </p>
        </div>
      </div>
    );
  if (recovery && !demo)
    return (
      <PasswordRecovery
        onDone={() => {
          setRecovery(false);
          window.history.replaceState({}, "", window.location.pathname);
        }}
      />
    );
  if (!user && !demo && (!publicMode || authRequested))
    return (
      <Auth
        initialMode={authMode}
        onDemo={() => {
          // Browse this workspace's real public records; never swap in demo fixtures.
          setAuthRequested(false);
          if (publicMode) navigateView("projects");
          else {
            void getPublicPreview(supabase!).then(preview => {
              if (!preview?.workspace) {
                setError("La vista pública no está disponible en este momento.");
                return;
              }
              setPublicMode(true);
              setWorkspace(preview.workspace);
              setItems((preview.records || []).map(normalizeExperiment));
              setMembers(preview.members || []);
              setActivity(preview.activity || []);
              setPublicAttachments(preview.attachments || []);
              navigateView("projects");
            }).catch(err => setError(err instanceof Error ? err.message : "No se pudo abrir la vista pública."));
          }
        }}
        onMessage={tell}
        onAuthenticated={(nextUser) => { setAuthRequested(false); setUser(nextUser); }}
      />
    );
  if (!workspace)
    return (
      <>
      <div className="account-actions">
        <button className="btn" onClick={() => publicMode ? requestAuth("signup") : setShowProfile(true)}>Mi perfil</button>
        <button className="btn" onClick={() => void supabase!.auth.signOut()}>Salir</button>
      </div>
      <TeamAccess error={error} onAccepted={async () => {
        const spaces = await listTeamSpaces(supabase!);
        setWorkspaces(spaces);
        setWorkspace(selectTeamSpace(spaces));
        setPendingInvite(""); setError("");
      }} />
      {profileEditor}
      </>
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigateView(publicMode?"projects":"map");
          }}
        >
          <img className="xperiments-logo" src="/logo.svg" width={695} height={258} alt="Xperiments · Experimental Innovation OS" />
        </a>
        <div className="sidebar-product-identity" aria-label="Experimental Innovation OS">
          <span>Experimental</span>
          <span className="identity-subtitle">Innovation OS</span>
        </div>
        <nav>
          {nav.map(({ id, label, icon: I }) => (
            <Fragment key={id}>
              <button
                className={view === id ? "active" : ""}
                onClick={() => navigateView(id)}
              >
                <I size={18} />
                {label}
                {id === "mvp" && (
                  <span className="nav-count" title="Fichas de MVPs Tree en el proyecto seleccionado" aria-label={`${mvpTreeCount} fichas de MVPs Tree`}>
                    {mvpTreeCount}
                  </span>
                )}
                {id === "map" && (
                  <span className="nav-count" title="Experimentos del proyecto seleccionado">{experiments.length}</span>
                )}
              </button>
              {id === "mvp" && (
                <div className="nav-subsections nav-mvp-subsections" aria-label="Secciones de MVPs Tree">
                  {mvpSubsections.map(({id: section, label: sectionLabel, icon: SubIcon, accent}) => (
                    <button key={section} type="button"
                      className={"nav-mvp-subsection " + accent + (view === section ? " active" : "")}
                      style={{color:treeAccentColor(accent)}}
                      onClick={() => navigateView(section)}>
                      <SubIcon size={16} color={treeAccentColor(accent)} aria-hidden="true" />{sectionLabel}
                    </button>
                  ))}
                </div>
              )}
              {id === "map" && (
                <div className="nav-subsections">
                  <button className={`nav-goi-subsection problemon ${view === "problemon" ? "active" : ""}`.trim()} style={{color:treeAccentColor("problemon")}} onClick={() => navigateView("problemon")}><Flag size={16} color={treeAccentColor("problemon")} aria-hidden="true" />Problema principal</button>
                  <button className={`nav-goi-subsection objective ${view === "goals" ? "active" : ""}`.trim()} onClick={() => navigateView("goals")}>
                    <Target size={16} aria-hidden="true" />{viewLabels.goals}
                  </button>
                  <button className={`nav-goi-subsection input-metric ${view === "input_metrics" ? "active" : ""}`.trim()} onClick={() => navigateView("input_metrics")}>
                    <BarChart3 size={16} aria-hidden="true" />{viewLabels.input_metrics}
                  </button>
                  <button className={`nav-goi-subsection opportunity ${view === "opportunities" ? "active" : ""}`.trim()} style={{color:treeAccentColor("opportunity")}} onClick={() => navigateView("opportunities")}><Search size={16} color={treeAccentColor("opportunity")} aria-hidden="true" />{viewLabels.opportunities}</button>
                  <button className={`nav-goi-subsection hypothesis ${view === "ideas" ? "active" : ""}`.trim()} style={{color:treeAccentColor("hypothesis")}} onClick={() => navigateView("ideas")}><Lightbulb size={16} color={treeAccentColor("hypothesis")} aria-hidden="true" />Hipótesis</button>
                  <button className={`nav-goi-subsection experiment ${view === "experiments" ? "active" : ""}`.trim()} style={{color:treeAccentColor("experiment")}} onClick={() => navigateView("experiments")}><FlaskConical size={16} color={treeAccentColor("experiment")} aria-hidden="true" />Experimentos <span className="nav-count">{experiments.length}</span></button>
                </div>
              )}
            </Fragment>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="profile">
            <Avatar name={profile.name} photo={profile.avatar_url} />
            <div>
              <strong>
                {profile.name}
              </strong>
              <span>
                {role === "owner"
                  ? "Superadministrador"
                  : role === "editor"
                    ? "Editor"
                    : "Lector"}
              </span>
            </div>
            <button aria-label="Editar mi perfil" title="Editar mi perfil" onClick={() => publicMode ? requestAuth("signup") : setShowProfile(true)}><UserRound size={17} /></button>
            {publicMode ? (
              <button aria-label="Iniciar sesión" title="Iniciar sesión" onClick={() => requestAuth("login")}>
                <LogIn size={17} />
              </button>
            ) : (
              <button aria-label="Salir" onClick={async () => {
                if (demo) {
                  setDemo(false);
                  if (!supabase) setDemo(true);
                  else setWorkspace(null);
                } else {
                  await supabase!.auth.signOut();
                }
              }}>
                <LogOut size={17} />
              </button>
            )}
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <button className="icon-button" aria-label="Mi perfil" title="Mi perfil" onClick={() => publicMode ? requestAuth("signup") : setShowProfile(true)}><UserRound size={17} /></button>
            {!demo && !publicMode && workspaces.length > 1 ? <label className="workspace-switch">
              <span className="sr-only">Espacio de trabajo</span>
              <select aria-label="Espacio de trabajo" value={workspace?.id || ""}
                disabled={saving || attachmentsBusy || assistantBusy || monitoringBusy || integrationBusy || loading}
                onChange={e => {
                  const next = selectTeamSpace(workspaces, e.target.value);
                  if (!next || next.id === workspace?.id) return;
                  ++loadVersion.current;
                  setMembers([]); setItems([]); setSelected(null); setDraft(null); setError("");
                  setWorkspace(next);
                  if (user) { try { localStorage.setItem(`xperiments.workspace.${user.id}`, next.id); } catch {} }
                }}>
                {workspaces.map(space => <option key={space.id} value={space.id}>{space.name || "Espacio de trabajo"}</option>)}
              </select>
            </label> : <span>{workspace?.name || "Espacio de trabajo"}</span>}
            <ChevronRight size={14} />
            <strong>{viewLabels[view] || nav.find((n) => n.id === view)?.label}</strong>
          </div>
          <div>
            {publicMode
              ? <>
                  <button className="btn" onClick={() => requestAuth("login")}><LogIn size={16}/><span>Iniciar sesión</span></button>
                  <button className="btn primary export-trigger" onClick={() => requestAuth("signup")}><UserRound size={16} /><span>Crear mi espacio gratis</span></button>
                </>
              : <button className="btn primary export-trigger" onClick={() => setShowBackup(true)}><Download size={16} /><span>Exportar</span></button>}
            <span className={"top-status" + (publicMode ? " public-status" : "")}>
              {publicMode ? "Vista pública · solo lectura" : demo ? "Datos de ejemplo" : "Espacio privado"}
            </span>
            <button
              className="icon-button"
              aria-label="Actualizar datos"
              onClick={() =>
                demo
                  ? tell("La demostración se guarda solo en esta sesión")
                  : void load()
              }
            >
              <RefreshCw size={17} className={loading ? "spin" : ""} />
            </button>
          </div>
        </header>
        <main>
          {demo && (
            <div className="demo-banner">
              <span>
                <strong>Demostración interactiva.</strong> Datos ficticios; los
                cambios se pierden al recargar.
              </span>
              <button
                onClick={() => {
                  if (supabase) setDemo(false);
                  else
                    tell(
                      "Para habilitar cuentas reales, configura Supabase siguiendo README.md.",
                    );
                }}
              >
                {supabase ? "Acceder al sistema" : "Cómo activar el sistema"}
              </button>
            </div>
          )}
          {view !== "ai" && (
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {view === "map" ? "ESTRATEGIA EN ACCIÓN" : "LABORATORIO"}
              </span>
              <h1>{viewLabels[view] || nav.find((n) => n.id === view)?.label}</h1>
              <p>
                {view === "map"
                  ? "La arquitectura de información diseñada para maximizar la generación de hipótesis de Growth con la máxima calidad, contexto, fundamento y orden."
                  : (mvpViews as readonly string[]).includes(view)
                    ? "Problemas, hipótesis, investigaciones y experimentos vinculados en el mismo proyecto, con fichas compartidas con Growth Tree."
                    : view === "experiments"
                    ? "Documenta qué vas a probar y cómo sabrás si funciona."
                    : view === "learning"
                      ? "Guarda lo que ocurrió, lo que aprendiste y qué harás después."
                      : view === "team"
                        ? "Gestiona las personas y sus permisos en el sistema."
                        : view === "integrations"
                          ? "Configura las cuentas y conexiones de tus proyectos en un único lugar."
                        : view === "projects"
                          ? "Cada proyecto tiene su propio Growth Tree, experimentos y aprendizajes."
                          : "Una guía sencilla para empezar a trabajar."}
              </p>
            </div>
            <div className="page-heading-actions">
              {(view === "projects" || view === "map") && <ExperimentalBookBanner />}
              {publicMode && <PublicViewBanner onSignup={() => requestAuth("signup")} />}
              {editable && createKind && (!projectScoped || currentProject) && (
                view === "map" ? (
                  <div className="create-control create-menu-wrap">
                    <Action className="primary" onClick={() => setShowCreateMenu(v => !v)}>
                      <Plus size={17} /> Crear
                    </Action>
                    {showCreateMenu && <div className="create-menu">
                      {(["goal", "opportunity", "hypothesis", "experiment"] as Kind[]).map(k => (
                        <button key={k} onClick={() => { setShowCreateMenu(false); create(k); }}>
                          {kinds[k]}
                        </button>
                      ))}
                    </div>}
                  </div>
                ) : (
                  <div className="create-control">
                    <Action className="primary" onClick={() => create(createKind)}>
                      <Plus size={17} /> Crear
                    </Action>
                  </div>
                )
              )}
            </div>
          </div>
          )}
          {error && !draft && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          {!demo && !schemaReady && (
            <div className="notice" role="status">
              La actualización por proyectos está pendiente de activar. Tus
              datos siguen guardados. El administrador debe completar el paso de
              Supabase indicado en el repositorio antes de crear o editar
              fichas.
            </div>
          )}
          {projectScoped && (
            <div className="project-filter panel">
              <label>
                Proyecto
                <select
                  aria-label="Seleccionar proyecto"
                  value={currentProject?.id || ""}
                  onChange={(e) => {
                    setProjectId(e.target.value);
                    setFilter("");
                    setSelected(null);
                    setDraft(null);
                  }}
                >
                  {!projects.length && <option value="">Sin proyectos</option>}
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </label>
              {currentProject && (
                <div className="selected-project">
                  <ProjectLogo project={currentProject} size="small" />
                  <div className="selected-project-copy">
                    <strong>{currentProject.title}</strong>
                    <p>
                      {projectDescription(currentProject)}
                    </p>
                    {projectUrl(currentProject.fields.site_url) && (
                      <a
                        className="project-link"
                        href={projectUrl(currentProject.fields.site_url)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {projectDomain(currentProject.fields.site_url)}
                        <ArrowUpRight size={14} />
                      </a>
                    )}
                  </div>
                </div>
              )}
              {currentProject && ["problemon", "goals", "input_metrics", "opportunities", "ideas", "experiments", "learning"].includes(view) && (
                <div className="project-filter-north-star">{renderNorthStarBanner(currentProject, true)}</div>
              )}
            </div>
          )}
          {projectScoped && !currentProject && (
            <Empty
              title="Empieza creando un proyecto"
              text="Cada proyecto tendrá su propio Growth Tree, experimentos y aprendizajes."
              action={can('project','create') ? () => create("project") : undefined}
            />
          )}
          {(["problemon","mvp_problemon"] as View[]).includes(view) && currentProject && renderProblemon()}
          {view === "mvp" && currentProject && (
            <MvpExperimentation
              project={currentProject} items={items}
              readOnly={publicMode || (!demo && !editable)}
              canCreate={kind => can(kind, "create")}
              canEdit={kind => can(kind, "edit")}
              canDelete={kind => can(kind, "delete")}
              onCreate={createMvp}
              onOpen={openMvp}
              onEdit={editMvp}
              onDelete={item => void deleteRecord(item)}
              onEditProject={() => editMvp(currentProject)}
              problemonSection={renderProblemon(true)}
            />
          )}
          {(["mvp_problems", "mvp_main_hypothesis", "mvp_hypotheses", "mvp_experiments", "mvp_research"] as View[]).includes(view) && currentProject && (
            <MvpHierarchy
              key={currentProject.id + ":" + view}
              view={view as "mvp_problems" | "mvp_main_hypothesis" | "mvp_hypotheses" | "mvp_experiments" | "mvp_research"}
              project={currentProject} items={items}
              readOnly={publicMode || (!demo && !editable)}
              canCreate={kind => can(kind, "create")}
              canEdit={kind => can(kind, "edit")}
              canDelete={kind => can(kind, "delete")}
              onCreate={createMvp}
              onOpen={openMvp}
              onEdit={editMvp}
              onDelete={item => void deleteRecord(item)}
            />
          )}
          {view === "map" && currentProject && (
            <>
              {renderProblemon(true)}
              <div className="stats">
                <Stat
                  label="Experimentos"
                  value={experiments.length}
                  hint="fichas de experimentación"
                  icon={<FlaskConical size={18} />}
                />
                <Stat
                  label="Con fecha de inicio"
                  value={experiments.filter((e) => e.fields.start).length}
                  hint="experimentos con fecha definida"
                  icon={<Check size={18} />}
                />
                <Stat
                  label="Hipótesis por validar"
                  value={items.filter((i) => i.kind === "hypothesis").length}
                  hint="en el árbol de crecimiento"
                  icon={<Lightbulb size={18} />}
                />
                <Stat
                  label="Oportunidades prioritarias"
                  value={
                    items.filter(
                      (i) => i.kind === "opportunity" && i.fields.focus,
                    ).length
                  }
                  hint="máximo 5 para mantener el foco"
                  icon={<Target size={18} />}
                />
              </div>
              {nsm ? (
                <button className="north-star" onClick={() => storedNsm ? setSelected(storedNsm) : setSelected(currentProject)}>
                  <div className="north-icon">
                    <Compass size={28} />
                  </div>
                  <div className="north-content">
                    <span>NORTH STAR METRIC</span>
                    <h2>{nsm.title}</h2>
                    <p>{northStarDescription}</p>
                    <span className="north-source">
                      {nsm.fields.frequency} · {nsm.fields.source}
                    </span>
                  </div>
                  <div className="north-value">
                    <strong>
                      {nsm.fields.current ?? "—"}
                      <small> / {nsm.fields.target ?? "—"}</small>
                    </strong>
                    <span>
                      {nsm.fields.unit} · {progress(nsm.fields)}% del recorrido
                    </span>
                    <Meter value={progress(nsm.fields)} />
                  </div>
                </button>
              ) : (
                <Empty
                  title="Define tu North Star"
                  text="Define la métrica que representa el valor que este proyecto aporta a sus usuarios."
                  action={can('north_star','create') ? () => create("north_star") : undefined}
                />
              )}
              <div className="section-heading">
                <div>
                  <h2>Growth Tree · {currentProject.title}</h2>
                  <p>North Star Metric → Objetivos e Input Metrics (mismo nivel) → Oportunidades-problemas → Hipótesis → Experimentos</p>
                </div>
                <Action onClick={() => void load()} disabled={loading}>
                  <RefreshCw size={16} /> Actualizar árbol
                </Action>
              </div>
              <div className="goi-peer-levels">
                {([
                  { key: "objectives", title: "Objetivos", action: "Nuevo objetivo" },
                  { key: "input_metrics", title: "Input Metrics", action: "Nueva Input Metric" },
                ] as const).map((section) => (
                  <section className={"goi-peer-section goi-peer-" + section.key} key={section.key}>
                    <div className="goi-peer-heading">
                      <div>
                        <h3 className="goi-peer-title">
                          {section.key === "input_metrics"
                            ? <BarChart3 size={20} aria-hidden="true" />
                            : <Target size={20} aria-hidden="true" />}
                          {section.title}
                        </h3>
                        <p>Hijos directos de North Star Metric</p>
                      </div>
                      {can("goal", "create") && nsm && (
                        <Action onClick={() => create("goal", null, section.key)}>
                          <Plus size={16} /> {section.action}
                        </Action>
                      )}
                    </div>
                    <div className="goi-grid">
                      {goals
                        .filter((g) =>
                          (storedNsm ? g.parent_id === storedNsm.id : !g.parent_id) &&
                          (section.key === "input_metrics"
                            ? g.fields.goi_section === "input_metrics"
                            : g.fields.goi_section !== "input_metrics")
                        )
                        .map((g) => (
                          <section className="goal-column" key={g.id}>
                            {itemCard(g)}
                            <details className="goal-content">
                              <summary>
                                <ChevronRight size={14} /> Oportunidades-problemas ({items.filter((i) => i.parent_id === g.id && i.kind === "opportunity").length})
                              </summary>
                              {items.filter((i) => i.parent_id === g.id && i.kind === "opportunity").map(branch)}
                              {can("opportunity", "create") && (
                                <button className="add-node" onClick={() => create("opportunity", g.id)}>
                                  <Plus size={14} /> Añadir oportunidad-problema
                                </button>
                              )}
                            </details>
                          </section>
                        ))}
                    </div>
                    {!goals.some((g) =>
                      (storedNsm ? g.parent_id === storedNsm.id : !g.parent_id) &&
                      (section.key === "input_metrics"
                        ? g.fields.goi_section === "input_metrics"
                        : g.fields.goi_section !== "input_metrics")
                    ) && (
                      <p className="goi-peer-empty">
                        {section.key === "input_metrics"
                          ? "Todavía no hay Input Metrics asociadas a la North Star."
                          : "Todavía no hay Objetivos asociados a la North Star."}
                      </p>
                    )}
                  </section>
                ))}
              </div>
              {items.some(item => ["opportunity", "hypothesis"].includes(item.kind) && !item.parent_id && !isProblemon(item)) && (
                <section className="goi-orphaned-panel panel">
                  <div className="section-heading">
                    <div>
                      <h2>Sin vincular · Elementos sin padre</h2>
                      <p>Conservados aunque se haya eliminado su elemento padre. Abre cada ficha para reasignarla cuando quieras.</p>
                    </div>
                  </div>
                  <div className="cards-grid">
                    {items.filter(item => ["opportunity", "hypothesis"].includes(item.kind) && !item.parent_id && !isProblemon(item)).map(item => itemCard(item))}
                  </div>
                </section>
              )}
              {items.some(item => item.kind === "experiment" &&
                (!item.parent_id || !items.some(parent => parent.id === item.parent_id && parent.kind === "hypothesis"))) && (
                <section className="goi-orphaned-panel panel" aria-label="Experimentos sin hipótesis">
                  <div className="section-heading">
                    <div>
                      <h2>Experimentos sin hipótesis</h2>
                      <p>Experimentos compartidos con MVPs Tree que aún no están vinculados a una hipótesis del Growth Tree.</p>
                    </div>
                  </div>
                  <div className="cards-grid">
                    {items.filter(item => item.kind === "experiment" &&
                      (!item.parent_id || !items.some(parent => parent.id === item.parent_id && parent.kind === "hypothesis")))
                      .map(item => itemCard(item))}
                  </div>
                </section>
              )}
              <div className="section-heading">
                <div>
                  <h2>Orden de ejecución</h2>
                  <p>
                    Prioriza las hipótesis y experimentos de este proyecto con ICE:
                    impacto × confianza × facilidad.
                  </p>
                </div>
              </div>
              <IceGuide />
              <div className="priority-list">
                {items
                  .filter((i) => ["hypothesis", "experiment"].includes(i.kind))
                  .sort((a, b) => score(b.fields) - score(a.fields))
                  .map((i, index) => (
                    <button
                      key={i.id}
                      className="priority-row"
                      onClick={() => setSelected(i)}
                    >
                      <span className="rank">{index + 1}</span>
                      <div>
                        <span className={"kind " + i.kind}>
                          {kinds[i.kind]}
                        </span>
                        <h3>{i.title}</h3>
                      </div>
                      <strong>ICE {score(i.fields)}</strong>
                    </button>
                  ))}
              </div>
              <div className="map-legend">
                <span>
                  <i className="legend-dot goal" /> Goal
                </span>
                <span>
                  <i className="legend-dot opportunity" /> Oportunidad
                </span>
                <span>
                  <i className="legend-dot hypothesis" /> Hipótesis
                </span>
                <span>
                  <i className="legend-dot experiment" /> Experimento
                </span>
                <span>Haz clic en un elemento para ver su ficha</span>
              </div>
            </>
          )}
          {view === "ideas" && currentProject && (
            <MvpHierarchy
              key={currentProject.id + ":growth-hypotheses"}
              view="mvp_hypotheses" treeName="Growth Tree"
              project={currentProject} items={items}
              readOnly={publicMode || (!demo && !editable)}
              canCreate={kind => can(kind,"create")}
              canEdit={kind => can(kind,"edit")}
              canDelete={kind => can(kind,"delete")}
              onCreate={createMvp}
              onOpen={item => {setMvpEditor(false);setSelected(item);}}
              onEdit={item => {setMvpEditor(false);setDraft(structuredClone(item));setSelected(null);setError("");}}
              onDelete={item => void deleteRecord(item)}
            />
          )}
          {(["goals", "input_metrics", "opportunities"] as View[]).includes(view) && currentProject && (
            <div className="goi-hierarchy-list">
              {(() => {
                const { target, roots, children, orphanOpportunities, orphanHypotheses } = getGoiHierarchy(items, view as "goals" | "input_metrics" | "opportunities" | "ideas");
                if (!target.length && !orphanOpportunities.length && !orphanHypotheses.length) return <Empty title={view === "goals" ? "Sin objetivos" : view === "input_metrics" ? "Sin input metrics" : view === "opportunities" ? "Sin oportunidades" : "Sin hipótesis"} text="Todavía no hay elementos en esta sección del Growth Tree." />;
                // Show roots, keeping every descendant level collapsed until its own toggle is used.
                const renderNode = (item: Item, visited: Set<string>): ReactNode => {
                  if (visited.has(item.id)) return null;
                  const nextVisited = new Set(visited);
                  nextVisited.add(item.id);
                  const descendants = children(item.id);
                  return (
                    <div className="goi-hierarchy-node" key={item.id}>
                      {itemCard(item, true)}
                      {descendants.length > 0 && (
                        <details key={view + ":" + item.id} className="goi-hierarchy-toggle">
                          <summary>
                            <ChevronRight size={16} aria-hidden="true"/>
                            <span className="goi-toggle-show">Mostrar hijos ({descendants.length})</span>
                            <span className="goi-toggle-hide">Ocultar hijos ({descendants.length})</span>
                          </summary>
                          <div className="goi-hierarchy-children">
                            {descendants.map(child => renderNode(child, nextVisited))}
                          </div>
                        </details>
                      )}
                    </div>
                  );
                };
                const renderGroup = (root: Item) => (
                  <section className="goi-hierarchy-group" key={root.id}>
                    {renderNode(root, new Set<string>())}
                  </section>
                );
                return (
                  <>
                    {orphanOpportunities.length > 0 && (
                      <section className="goi-orphans-section" aria-label="Oportunidades-problemas huérfanos">
                        <div className="goi-orphans-heading">
                          <h2><Search size={19} aria-hidden="true" /> Oportunidades-problemas huérfanos <span>({orphanOpportunities.length})</span></h2>
                          <p>Sin objetivo o Input Metric padre. Abre la ficha para asignarle uno.</p>
                        </div>
                        {orphanOpportunities.map(renderGroup)}
                      </section>
                    )}
                    {orphanHypotheses.length > 0 && (
                      <section className="goi-orphans-section" aria-label="Hipótesis huérfanas">
                        <div className="goi-orphans-heading">
                          <h2><Lightbulb size={19} aria-hidden="true" /> Hipótesis huérfanas <span>({orphanHypotheses.length})</span></h2>
                          <p>Sin oportunidad-problema padre. Abre la ficha para asignarle una.</p>
                        </div>
                        {orphanHypotheses.map(renderGroup)}
                      </section>
                    )}
                    {roots.map(renderGroup)}
                  </>
                );
              })()}
            </div>
          )}
          {view === "experiments" && currentProject && (
            <>
              <div className="filterbar">
                <label className="search">
                  <Search size={17} />
                  <input
                    aria-label="Buscar experimentos"
                    placeholder="Buscar por nombre, responsable, hipótesis o etiquetas…"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                </label>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Experimento</th>
                      <th>Responsable</th>
                      <th>ICE</th>
                      <th>Fecha de inicio</th>
                      <th>Etiquetas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleExperiments.map((e) => (
                      <tr key={e.id}>
                        <td>
                          <button
                            className="table-title"
                            onClick={() => setSelected(e)}
                          >
                            {experimentTag(e)}
                            {parentTag(e)}
                            <span className="experiment-list-summary">
                              <strong>Contexto</strong> {e.fields.context || "Sin contexto documentado"}
                            </span>
                            <span className="experiment-list-summary">
                              <strong>Hipótesis</strong> {e.fields.hypothesis || "Sin hipótesis documentada"}
                            </span>
                            <span>
                              {e.fields.metric || "Métrica pendiente"}
                            </span>
                          </button>
                        </td>
                        <td>
                          {e.owner_id ? author(e.owner_id) : "—"}
                        </td>
                        <td>
                          <strong>{score(e.fields)}</strong>
                        </td>
                        <td>{e.fields.start || "—"}</td>
                        <td>{e.fields.tags || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!visibleExperiments.length && (
                <Empty
                  title="Sin experimentos en esta vista"
                  text="Cambia la búsqueda o crea tu primer experimento."
                />
              )}
            </>
          )}
          {view === "projects" && (
            <div className="cards-grid">
              {projects.map((p) => (
                <section className="project-card panel" key={p.id}>
                  <div className="project-card-head">
                    <ProjectLogo project={p} />
                    <button
                      className="plain-heading project-card-heading"
                      onClick={() => {
                        setProjectId(p.id);
                        navigateView("map");
                        setFilter("");
                      }}
                    >
                      <span className="eyebrow">PROYECTO</span>
                      <h2>{p.title}</h2>
                      <p className="project-description">
                        {projectDescription(p)}
                      </p>
                    </button>
                  </div>
                  {projectUrl(p.fields.site_url) && (
                    <a
                      className="project-link project-card-link"
                      href={projectUrl(p.fields.site_url)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {projectDomain(p.fields.site_url)}
                      <ArrowUpRight size={14} />
                    </a>
                  )}
                  <p className="small">
                    {workspaceItems.filter((e) => e.kind === "experiment" && e.project_id === p.id).length} experimentos
                  </p>
                  <div className="row">
                    <Action
                      onClick={() => {
                        setProjectId(p.id);
                        navigateView("map");
                      }}
                    >
                      Abrir Growth Tree
                    </Action>
                    {can('project','edit') && (
                      <Action onClick={() => setSelected(p)}>
                        Editar proyecto
                      </Action>
                    )}
                    {!publicMode && <PostHogProjectPanel
                      project={p}
                      experiments={workspaceItems.filter((e) => e.kind === "experiment" && e.project_id === p.id)}
                      workspaceId={workspace.id}
                      userId={user?.id || null}
                      editable={can('experiment','create') && !demo && !publicMode}
                      onSynced={() => load()}
                    />}
                  </div>
                </section>
              ))}
              {!projects.length && (
                <Empty
                  title="Crea tu primer proyecto"
                  text="Organiza cada producto o iniciativa con su propio árbol y experimentos."
                  action={can('project','create') ? () => create("project") : undefined}
                />
              )}
            </div>
          )}
          {view === "learning" && currentProject && (
            <div className="learning-list">
              <label className="search">
                <Search size={17} />
                <input
                  aria-label="Buscar aprendizajes"
                  placeholder="Buscar por aprendizaje, contexto o etiquetas…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </label>
              {items
                .filter(
                  (i) =>
                    i.kind === "learning" &&
                    [
                      i.title,
                      i.fields.learning,
                      i.fields.result,
                      i.fields.context,
                      i.fields.tags,
                    ]
                      .join(" ")
                      .toLowerCase()
                      .includes(filter.toLowerCase()),
                )
                .map((item) => (
                  <article className="learning-card panel" key={item.id}>
                    <button
                      className="plain-heading"
                      onClick={() => setSelected(item)}
                    >
                      <span className="eyebrow">APRENDIZAJE</span>
                      <h2>{item.title}</h2>
                    </button>
                    {item.parent_id && (
                      <p className="small">
                        Experimento:{" "}
                        {items.find((e) => e.id === item.parent_id)?.title}
                      </p>
                    )}
                    <div className="learning-grid">
                      <div>
                        <span className="eyebrow">RESULTADO</span>
                        <p>{item.fields.result || "Pendiente de documentar"}</p>
                      </div>
                      <div>
                        <span className="eyebrow">APRENDIZAJE</span>
                        <p>{item.fields.learning}</p>
                      </div>
                      <div>
                        <span className="eyebrow">SIGUIENTE PASO</span>
                        <p>
                          {item.fields.next_steps ||
                            item.fields.decision ||
                            "Por definir"}
                        </p>
                        <span className="small">{item.fields.tags}</span>
                      </div>
                    </div>
                  </article>
                ))}
              {!items.some((i) => i.kind === "learning") && (
                <Empty
                  title="Documenta lo que has aprendido"
                  text="Guarda el resultado, la evidencia, la conclusión y el siguiente paso en una ficha separada del experimento."
                  action={can('learning','create') ? () => create("learning") : undefined}
                />
              )}
            </div>
          )}
          {view === "team" && publicMode && (
            <div className="panel"><h2>Equipo</h2><p>La configuración, los miembros y las invitaciones del equipo son privados. Puedes consultar el trabajo de cada proyecto en las demás secciones.</p><button className="btn primary" onClick={() => requestAuth("signup")}>Crear mi espacio gratis</button></div>
          )}
          {view === "team" && !publicMode && (
            <>
              <div className="panel">
                <div className="section-heading">
                  <div>
                    <h2>Nombre del equipo</h2>
                    <p>Este nombre se muestra en los enlaces de invitación.</p>
                  </div>
                </div>
                {role === "owner" && !demo ? (
                  <div className="row">
                    <input
                      aria-label="Nombre del equipo"
                      value={teamNameDraft}
                      maxLength={120}
                      onChange={(e) => setTeamNameDraft(e.target.value)}
                    />
                    <Action
                      disabled={!teamNameDraft.trim() || teamNameDraft.trim() === (workspace.name || "").trim()}
                      onClick={async () => {
                        const nextName = teamNameDraft.trim();
                        const r = await supabase!.rpc("rename_team", { w: workspace.id, team_name: nextName });
                        if (r.error) tell(r.error.message);
                        else {
                          setWorkspace({ ...workspace, name: nextName });
                          tell("Nombre del equipo actualizado");
                        }
                      }}
                    >
                      Guardar nombre
                    </Action>
                  </div>
                ) : (
                  <strong>{workspace.name || "Equipo de experimentación"}</strong>
                )}
              </div>
              <div className="panel">
                <div className="section-heading">
                  <h2>Miembros del equipo</h2>
                  <span>{members.length} personas</span>
                </div>
                <p className="small">El superadministrador gestiona las APIs y el equipo. Para un Editor, abre «Permisos» y elige qué puede crear, editar o eliminar. Un Editor nuevo comienza con acceso de consulta hasta que le concedas esas acciones.</p>
                {members.map((m) => (
                  <Fragment key={m.user_id}><div className="member-row">
                    <Avatar name={m.name} photo={m.avatar_url} />
                    <strong>{m.name}</strong>
                    {role === "owner" && m.role !== "owner" && !demo ? (
                      <>
                        <select
                          aria-label={"Rol de " + m.name}
                          value={m.role}
                          onChange={async (e) => {
                            const r = await supabase!.rpc(
                              "change_member_role",
                              {
                                w: workspace.id,
                                member_id: m.user_id,
                                new_role: e.target.value,
                              },
                            );
                            if (r.error) tell(r.error.message);
                            else await load();
                          }}
                        >
                          <option value="editor">Editor</option>
                          <option value="viewer">Lector</option>
                        </select>
                        <button
                          onClick={async () => {
                            if (
                              !window.confirm(
                                "¿Retirar el acceso de " +
                                  m.name +
                                  " al sistema? Sus acciones permanecerán en el historial.",
                              )
                            )
                              return;
                            const r = await supabase!.rpc("remove_member", {
                              w: workspace.id,
                              member_id: m.user_id,
                            });
                            if (r.error) tell(r.error.message);
                            else await load();
                          }}
                        >
                          Retirar acceso
                        </button>
                      </>
                    ) : (
                      <span className="badge">
                        {m.role === "owner"
                          ? "Superadministrador"
                          : m.role === "editor"
                            ? "Editor"
                            : "Lector"}
                      </span>
                    )}
                  </div><MemberPermissions key={`${m.user_id}:${m.role}:${(m.permissions||[]).join(',')}`} member={m} workspaceId={workspace.id} editable={role==='owner'&&!demo} onSaved={load}/></Fragment>
                ))}
              </div>
              {role === "owner" && (
                <div className="panel invite-panel">
                  <h2>Invitar a una persona</h2>
                  <p>
                    El enlace es de un solo uso y caduca en 7 días. Al abrirlo,
                    la persona verá que está invitada a <strong>{workspace.name || "este equipo"}</strong>,
                    podrá crear su cuenta y entrará directamente en el equipo.
                  </p>
                  <div className="row">
                    <select
                      aria-label="Rol de la invitación"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                    >
                      <option value="editor">Editor · permisos configurables</option>
                      <option value="viewer">Lector · consultar</option>
                    </select>
                    <Action
                      onClick={async () => {
                        if (demo) {
                          tell(
                            "Las invitaciones reales se habilitan al conectar Supabase",
                          );
                          return;
                        }
                        const r = await supabase!.rpc("create_invitation", {
                          w: workspace.id,
                          invite_role: inviteRole,
                        });
                        if (r.error) tell(r.error.message);
                        else {
                          setInviteUrl(
                            window.location.origin + "/?invite=" + r.data,
                          );
                          await load();
                        }
                      }}
                    >
                      <Plus size={16} /> Crear enlace
                    </Action>
                  </div>
                  {inviteUrl && (
                    <div className="copy-link">
                      <input
                        readOnly
                        aria-label="Enlace de invitación"
                        value={inviteUrl}
                      />
                      <Action
                        onClick={() => {
                          void navigator.clipboard
                            .writeText(inviteUrl)
                            .then(() => tell("Enlace copiado"))
                            .catch(() => tell("Copia el enlace manualmente"));
                        }}
                      >
                        <Copy size={16} /> Copiar
                      </Action>
                    </div>
                  )}
                  {invitations
                    .filter(
                      (i) => !i.used_by && new Date(i.expires_at) > new Date(),
                    )
                    .map((i) => (
                      <div key={i.id} className="member-row">
                        <span>
                          {i.role === "editor" ? "Editor" : "Lector"} · caduca{" "}
                          {new Date(i.expires_at).toLocaleDateString("es")}
                        </span>
                        <button
                          onClick={async () => {
                            const r = await supabase!.rpc("revoke_invitation", {
                              w: workspace.id,
                              invitation_id: i.id,
                            });
                            if (r.error) tell(r.error.message);
                            else await load();
                          }}
                        >
                          Revocar
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </>
          )}
          {view === "method" && <Method />}
          {view === 'ai' && <StrategicAI key={`${workspace.id}:${user?.id||'demo'}`} workspace={workspace} project={currentProject} disabled={demo||publicMode} canImport={can('learning','create')} canEdit={can('learning','edit')} canDelete={can('learning','delete')} canCreate={can('experiment','create')} onProposal={openAIProposal}/>}
          {view === 'integrations' && publicMode && (
            <div className="panel"><h2>Integraciones</h2><p>Las conexiones, credenciales y configuraciones de servicios externos son privadas. Inicia sesión para gestionar las conexiones de tu equipo.</p><button className="btn primary" onClick={() => requestAuth("signup")}>Crear mi espacio gratis</button></div>
          )}
          {view === 'integrations' && !publicMode && <IntegrationSettings key={`${workspace.id}:${user?.id||'demo'}`} workspaceId={workspace.id} projects={projects} demo={demo||publicMode} onSaved={load} onBusy={setIntegrationBusy}/>}
          <footer className="footer">
            <span>Experimental Innovation OS · Imagine Builder</span>
            <a href="/privacy-policy">Política de privacidad</a>
            <a href="/plugins/validacion-de-negocios">Plugin · Validación de negocios</a>
            <button onClick={() => publicMode ? requestAuth("signup") : setShowBackup(true)}>
              {publicMode ? "Crear mi espacio gratis" : "Exportar copia completa"}
            </button>
          </footer>
        </main>
      </div>
      {profileEditor}
      {showBackup && <BackupDialog onClose={() => setShowBackup(false)} onExport={exportData} />}
      <dialog
        ref={detail}
        className="detail-dialog"
        onCancel={e => { if (attachmentsBusy || monitoringBusy) e.preventDefault(); else setSelected(null); }}
        onClick={(e) => {
          if (!attachmentsBusy && !monitoringBusy && e.target === detail.current) setSelected(null);
        }}
      >
        {selected && (
          <div className="detail-content">
            <div className="row">
              {["goal","opportunity","hypothesis"].includes(selected.kind) ? goiTitleTag(selected) : <span className={"kind " + selected.kind}><IconFor kind={selected.kind}/>{kinds[selected.kind]}</span>}
              <button
                className="icon-button"
                aria-label="Cerrar ficha"
                disabled={attachmentsBusy || monitoringBusy}
                onClick={() => setSelected(null)}
              >
                <X />
              </button>
            </div>
            <div className="breadcrumb">
              {ancestors(selected, items)
                .slice(0, -1)
                .map((i) => i.title)
                .join(" / ")}
            </div>
            {selected.kind === "experiment" ? <h2 className="experiment-detail-title"><FlaskConical size={22} aria-hidden="true"/>{selected.title}</h2> : selected.kind === "hypothesis" ? <h2 className="hypothesis-detail-title"><Lightbulb size={22} aria-hidden="true"/>{selected.title}</h2> : ["goal","opportunity","hypothesis"].includes(selected.kind) ? null : <h2>{selected.title}</h2>}
            {selected.parent_id && items.some(i => i.id === selected.parent_id) && <div className="record-relation"><span>Hijo de</span>{parentTag(selected)}</div>}
            <div className="row detail-meta">
              {selected.owner_id && (
                <span>Responsable: {author(selected.owner_id)}</span>
              )}
              {selected.kind !== "experiment" && selected.fields.status && (
                <Badge state={selected.fields.status} />
              )}
            </div>
            {can(selected.kind,'edit') && (demo || schemaReady) && (
              <Action
                className="primary"
                disabled={attachmentsBusy || monitoringBusy}
                onClick={() => {
                  setDraft(structuredClone(selected));
                  setSelected(null);
                  setError("");
                }}
              >
                Editar ficha
              </Action>
            )}
            {can(selected.kind,'delete') && !demo && !publicMode && ["project", "experiment", "learning", "goal", "opportunity", "hypothesis", "research"].includes(selected.kind) && (
              <Action
                disabled={attachmentsBusy || monitoringBusy}
                onClick={() => void deleteRecord(selected)}
              >
                Eliminar
              </Action>
            )}
            {selected.kind === "experiment" && can('learning','create') && (
              <Action
                disabled={attachmentsBusy || monitoringBusy}
                onClick={() => {
                  create("learning", selected.id);
                  setSelected(null);
                }}
              >
                Documentar aprendizaje
              </Action>
            )}
            {supportsAttachments(selected.kind) ? <RecordAttachments key={selected.id}
              record={selected} editable={can(selected.kind,'edit')} demo={demo} prefetched={publicMode} values={publicMode ? publicAttachments.filter(a => a.record_id === selected.id) : (demoAttachments[selected.id] || [])}
              onDemoChange={values => setDemoAttachments(prev => ({ ...prev, [selected.id]: values }))} onBusy={setAttachmentsBusy}>
              {({ links, files }) => selected.kind === "experiment" ? <>
                <FieldDetails record={selected} fields={experimentSections.primary} />
                {links}
                {['meta_ads','google_ads'].includes(String(selected.fields.channel))?<>
                  <p><strong>Canal:</strong> {selected.fields.channel==='meta_ads'?'Meta Ads':'Google Ads'}</p>
                  {!publicMode&&selected.fields.channel==='meta_ads'&&<MetaExperimentDelivery key={selected.id} experiment={selected} openOnArrival={metaPreparationTarget===selected.id} editable={can('experiment','edit')} demo={demo} onBusy={setMonitoringBusy}/>}
                  {!publicMode&&!demo&&selected.fields.channel==='google_ads'&&<GoogleAdsPreparation key={selected.id} experiment={selected} openOnArrival={googlePreparationTarget===selected.id} editable={can('experiment','edit')} locked={false} onBusy={setMonitoringBusy} onSaved={load}/>}
                </>:posthogChannels.includes(String(selected.fields.channel))?<>
                  <p><strong>Canal:</strong> {selected.fields.channel==='posthog'?'PostHog · Experimento A/B':selected.fields.channel==='web_app'?'Web app · PostHog':'App móvil · PostHog'}</p>
                  {!publicMode&&!demo&&<PosthogPreparation key={selected.id} experiment={selected} editable={can('experiment','edit')} openOnArrival={posthogPreparationTarget===selected.id} onBusy={setMonitoringBusy} onSaved={record=>{setSelected(normalizeExperiment(record));void load();}}/>}
                  {!publicMode&&<PostHogResults experiment={selected} project={currentProject}/>}
                </>:<>
                  <ExecutionDetails key={selected.id} experiment={selected}/>
                  {!publicMode&&['web_app','mobile_ios','mobile_android'].includes(String(selected.fields.channel))&&<PostHogResults experiment={selected} project={currentProject} />}
                  {!publicMode && <ExperimentMonitoring key={selected.id} experiment={selected}
                    editable={can('experiment','edit')} demo={demo} onBusy={setMonitoringBusy}/>}

                </>}

                <section className="experiment-ice"><h3>ICE</h3><FieldDetails record={selected} fields={experimentSections.ice} /></section>
                {files}
              </> : <>{selected.kind === "hypothesis" ? <HypothesisDetails record={selected} /> : <FieldDetails record={selected} fields={mvpEditor && mvpSchemas[selected.kind] ? mvpSchemas[selected.kind]! : schemas[selected.kind]} />}{links}{files}</>}
            </RecordAttachments> : selected.kind === "hypothesis" ? <HypothesisDetails record={selected} /> : <FieldDetails record={selected} fields={mvpEditor && mvpSchemas[selected.kind] ? mvpSchemas[selected.kind]! : schemas[selected.kind]} />}
            {["goal", "opportunity", "hypothesis", "research", "experiment"].includes(selected.kind) && !publicMode && (
              <section className="record-activity">
                <div className="record-activity-head">
                  <div>
                    <h3>Actividad y comentarios</h3>
                    <p>Queda registrado quién crea o modifica esta ficha.</p>
                  </div>
                </div>
                {can(selected.kind,'edit') && (
                  <form
                    className="comment-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void addRecordComment();
                    }}
                  >
                    <textarea
                      aria-label="Añadir comentario"
                      placeholder="Escribe un comentario…"
                      rows={3}
                      maxLength={5000}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="btn primary"
                      disabled={commentBusy || !commentText.trim()}
                    >
                      {commentBusy ? "Publicando…" : "Comentar"}
                    </button>
                  </form>
                )}
                <div className="activity-feed">
                  {[
                    ...selectedHistory.map((entry) => ({
                      id: "history-" + entry.id,
                      type: "history" as const,
                      created_at: entry.created_at,
                      actor: entry.actor_name || author(entry.actor_id),
                      text:
                        entry.action === "insert"
                          ? "creó la ficha"
                          : entry.action === "update"
                            ? "modificó la ficha"
                            : entry.action,
                    })),
                    ...recordComments.map((comment) => ({
                      id: "comment-" + comment.id,
                      type: "comment" as const,
                      created_at: comment.created_at,
                      actor: comment.author_name || author(comment.author_id),
                      text: comment.body,
                    })),
                  ]
                    .sort(
                      (a, b) =>
                        new Date(b.created_at).getTime() -
                        new Date(a.created_at).getTime(),
                    )
                    .map((entry) => (
                      <div className={"activity-entry " + entry.type} key={entry.id}>
                        <div className="activity-entry-meta">
                          <strong>{entry.actor}</strong>
                          <span>
                            {new Date(entry.created_at).toLocaleString("es")}
                          </span>
                        </div>
                        <p>
                          {entry.type === "history" ? entry.text : entry.text}
                        </p>
                      </div>
                    ))}
                  {!selectedHistory.length && !recordComments.length && (
                    <p className="small">Todavía no hay actividad adicional.</p>
                  )}
                </div>
              </section>
            )}
            <div className="detail-audit">
              Creado por{" "}
              {selected.created_by_name || author(selected.created_by)} ·{" "}
              {new Date(selected.created_at).toLocaleDateString("es")}
              <br />
              Última edición:{" "}
              {selected.updated_by_name || author(selected.updated_by)} ·{" "}
              {new Date(selected.updated_at).toLocaleString("es")}
            </div>
          </div>
        )}
      </dialog>
      <dialog
        ref={dialog}
        className="edit-dialog"
        onCancel={e => {
          if (saving || attachmentsBusy || assistantBusy) e.preventDefault(); else setDraft(null);
        }}
      >
        {draft && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const submitter=(e.nativeEvent as SubmitEvent).submitter;
              void save(submitter instanceof HTMLButtonElement&&submitter.dataset.prepareMeta==='true',submitter instanceof HTMLButtonElement&&submitter.dataset.prepareGoogle==='true',submitter instanceof HTMLButtonElement&&submitter.dataset.preparePosthog==='true');
            }}
          >
            <div className="dialog-head">
              <div>
                <span className="eyebrow">
                  {allItems.some((i) => i.id === draft.id) ? "EDITAR" : "CREAR"}{" "}
                  {draft.kind === "goal" && draft.fields.goi_section === "input_metrics" ? "INPUT METRIC" : kinds[draft.kind].toUpperCase()}
                </span>
                <h2 className={draft.kind === "hypothesis" ? "hypothesis-detail-title" : undefined}>{draft.kind === "hypothesis" && <Lightbulb size={22} aria-hidden="true" />}{draft.title || "Nueva ficha"}</h2>
                {draft.parent_id && ["opportunity","hypothesis","experiment"].includes(draft.kind) && items.some(i => i.id === draft.parent_id) && (
                  <div className="record-relation"><span>Hijo de</span>{parentTag(draft)}</div>
                )}
              </div>
              <EditorDictation/>
              <button
                type="button"
                className="icon-button"
                aria-label="Cerrar formulario"
                disabled={saving || attachmentsBusy || assistantBusy}
                onClick={() => setDraft(null)}
              >
                <X />
              </button>
            </div>
            <div className="form-body">
              <p className="small full" role="note">Los textos nuevos quedan vacíos. La IA solo rellena una ficha cuando le pides una propuesta y pulsas expresamente «Rellenar formulario para revisar».</p>
              <label className="full">
                Nombre
                <input
                  required
                  value={draft.title}
                  onChange={(e) =>
                    setDraft({ ...draft, title: e.target.value })
                  }
                />
              </label>
              {draft.kind !== "project" && (
                <label>
                  Responsable
                  <select
                    value={draft.owner_id || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, owner_id: e.target.value || null })
                    }
                  >
                    <option value="">Sin asignar</option>
                    {members.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {draft.kind === "opportunity" && (
                <label className="check-label full problemon-editor-toggle">
                  <input type="checkbox" checked={isProblemon(draft)}
                    disabled={!!currentProject && !!getProblemon(items,currentProject.id) &&
                      getProblemon(items,currentProject.id)?.id!==draft.id && !isProblemon(draft)}
                    onChange={event=>setDraft({...draft,
                      fields:{...draft.fields,is_problemon:event.target.checked}})}
                  />
                  <span><strong>Problema principal del proyecto</strong>
                    <small>Solo puede haber uno. Desmarcarlo conserva la ficha, sus hijos y sus vínculos.</small>
                  </span>
                </label>
              )}
              {draft.kind === "goal" && (
                <label>
                  Depende de North Star Metric
                  <select
                    value={draft.parent_id || ""}
                    onChange={(e) => setDraft({ ...draft, parent_id: e.target.value || null })}
                  >
                    {!storedNsm && <option value="">North Star del proyecto (se creará automáticamente)</option>}
                    {storedNsm && <option value={storedNsm.id}>North Star Metric: {storedNsm.title}</option>}
                  </select>
                </label>
              )}
              {draft.kind === "hypothesis" && <label className="check-label full">
                <input type="checkbox" checked={draft.fields.is_main_hypothesis===true}
                  disabled={items.some(item=>item.kind==="hypothesis"&&item.id!==draft.id&&item.fields.is_main_hypothesis===true)&&draft.fields.is_main_hypothesis!==true}
                  onChange={event=>setDraft({...draft,fields:{...draft.fields,is_main_hypothesis:event.target.checked}})}/>
                Hipótesis principal (padre predeterminado de los nuevos experimentos)
              </label>}
              {draft.kind !== "experiment" && draft.kind !== "goal" && parents[draft.kind] && (
                <label>
                  {draft.kind === "opportunity" ? "Objetivo o Input Metric al que pertenece" : draft.kind==="hypothesis" ? "Padre de la hipótesis (Problema principal predeterminado)" : kinds[parents[draft.kind]!] + " al que pertenece"}
                  <select
                    value={draft.parent_id || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, parent_id: e.target.value || null })
                    }
                  >
                    <option value="">Sin padre (puedes asignarlo más adelante)</option>
                    {items
                      .filter(
                        (i) =>
                          i.kind === parents[draft.kind] &&
                          i.id !== draft.id &&
                          !ancestors(i, items).some((a) => a.id === draft.id),
                      )
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          {draft.kind === "opportunity" && i.kind === "goal"
                            ? (i.fields.goi_section === "input_metrics" ? "Input Metric: " : "Objetivo: ") + i.title
                            : draft.kind==="hypothesis" && isProblemon(i) ? "Problema principal (predeterminado): "+i.title : i.title}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {draft.kind === "experiment" && (
                <>
                  <label>
                    Hipótesis padre (principal predeterminada; compartida entre Growth Tree y MVPs Tree)
                    <select value={draft.parent_id || String(draft.fields.mvp_hypothesis_id || "")}
                      onChange={e => setDraft({...draft,parent_id:e.target.value || null,
                        fields:{...draft.fields,mvp_hypothesis_id:e.target.value}})}>
                      <option value="">Experimento sin hipótesis</option>
                      {items.filter(item => item.kind === "hypothesis").map(item =>
                        <option key={item.id} value={item.id}>{item.fields.is_main_hypothesis===true?"Hipótesis principal: ":""}{item.title}</option>)}
                    </select>
                  </label>
                </>
              )}
              {draft.kind === "research" && (
                <fieldset className="mvp-link-fieldset full">
                  <legend>Vincular a problemas e hipótesis (puedes elegir varios)</legend>
                  {items.filter(item => item.kind === "opportunity" || item.kind === "hypothesis").map(item => {
                    const selectedLinks=String(draft.fields.mvp_links || "").split(",").filter(Boolean);
                    return <label className="mvp-link-option" key={item.id}>
                      <input type="checkbox" checked={selectedLinks.includes(item.id)} onChange={e => {
                        const links=e.target.checked ? [...selectedLinks,item.id] : selectedLinks.filter(id=>id!==item.id);
                        setDraft({...draft,fields:{...draft.fields,mvp_links:links.join(",")}});
                      }}/>
                      {kinds[item.kind]}: {item.title}
                    </label>;
                  })}
                  {!items.some(item => item.kind === "opportunity" || item.kind === "hypothesis") && <p>Crea primero un problema o una hipótesis para poder vincular esta investigación.</p>}
                </fieldset>
              )}
              {draft.kind === "kr" && (
                <label>
                  Goal vinculado
                  <select
                    value={draft.related_id || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, related_id: e.target.value || null })
                    }
                  >
                    <option value="">Sin vincular</option>
                    {goals
                      .filter((g) => g.parent_id === nsm?.id)
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.title}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {supportsAttachments(draft.kind) ? <RecordAttachments key={draft.id}
                record={draft} editable={can(draft.kind,'edit') && !saving} demo={demo} prefetched={publicMode} values={publicMode ? publicAttachments.filter(a => a.record_id === draft.id) : (demoAttachments[draft.id] || [])}
                persisted={allItems.some(item => item.id === draft.id)}
                onDemoChange={values => setDemoAttachments(prev => ({ ...prev, [draft.id]: values }))} onBusy={setAttachmentsBusy}>
                {({ links, files }) => <>{draftFields(links)}{draft.kind !== "experiment" && <div className="full">{links}</div>}<div className="full">{files}</div></>}
              </RecordAttachments> : draftFields()}
              {error && (
                <div role="alert" className="error full">
                  {error}
                </div>
              )}
            </div>
            <div className="dialog-foot">
              <button
                type="button"
                className="btn"
                disabled={saving || attachmentsBusy || assistantBusy}
                onClick={() => setDraft(null)}
              >
                Cancelar
              </button>
              <button type="submit" className="btn primary" disabled={saving || attachmentsBusy || assistantBusy}>
                {saving ? "Guardando…" : "Guardar ficha"}
              </button>
              {draft.kind==='experiment'&&draft.fields.channel==='meta_ads'&&!demo&&!publicMode&&can('experiment','edit')&&<button type="submit" data-prepare-meta="true" className="btn primary" disabled={saving||attachmentsBusy||assistantBusy}>Guardar y revisar envío a Meta</button>}
              {draft.kind==='experiment'&&draft.fields.channel==='google_ads'&&!demo&&!publicMode&&can('experiment','edit')&&<button type="submit" data-prepare-google="true" className="btn primary" disabled={saving||attachmentsBusy||assistantBusy}>Enviar a Google Ads</button>}
              {draft.kind==='experiment'&&posthogChannels.includes(String(draft.fields.channel))&&!demo&&!publicMode&&can('experiment','edit')&&<button type="submit" data-prepare-posthog="true" className="btn primary" disabled={saving||attachmentsBusy||assistantBusy}>Enviar a PostHog</button>}
            </div>
          </form>
        )}
      </dialog>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}
function Stat({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: number;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="stat">
      <div className="row">
        <span>{label}</span>
        {icon}
      </div>
      <strong>{value}</strong>
      <span className="small">{hint}</span>
    </div>
  );
}
function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: () => void;
}) {
  return (
    <div className="empty">
      <GitBranch size={28} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <Action className="primary" onClick={action}>
          <Plus size={16} /> Crear
        </Action>
      )}
    </div>
  );
}
function Auth({
  initialMode = "login",
  invitation,
  onDemo,
  onMessage,
  onAuthenticated,
}: {
  initialMode?: "login" | "signup";
  invitation?: InvitationPreview | null;
  onDemo: () => void;
  onMessage: (s: string) => void;
  onAuthenticated: (user: User) => void;
}) {
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<
    "login" | "signup" | "reset" | "new-password"
  >(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const { data } = supabase!.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("new-password");
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return (
    <div className="auth-shell">
      <div className="auth-intro">
        <BrandIdentity />
        <h1>
          Cada hipótesis merece
          <br />
          un experimento.
        </h1>
        <p>
          Un equipo alineado. Un árbol de oportunidades.
          <br />
          Un lugar para aprender juntos.
        </p>
        <div className="auth-steps">
          <span>North Star</span>
          <span>Growth Tree</span>
          <span>Experimentos</span>
        </div>
      </div>
      <div className="auth-card">
        <div className="auth-mobile-brand"><BrandIdentity /></div>
        <span className="eyebrow">EXPERIMENTAL INNOVATION OS</span>
        {invitation && (
          <div className="notice">
            <strong>Estás invitado a unirte al equipo {invitation.team_name}</strong>
            <p>
              Acceso como {invitation.role === "editor" ? "Editor" : "Lector"}.
              Crea tu cuenta o inicia sesión y entrarás directamente en el equipo.
            </p>
          </div>
        )}
        <h2>
          {mode === "signup"
            ? "Crea tu cuenta"
            : mode === "reset"
              ? "Recupera tu acceso"
              : mode === "new-password"
                ? "Nueva contraseña"
                : "Entra en Experimental OS"}
        </h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            setMessage("");
            try {
              if (mode === "signup") {
                const nextUser = await registerAccount(supabase!, {
                  email, password, name,
                  redirectTo: window.location.origin + window.location.pathname + (invitation ? window.location.search : ""),
                });
                if (nextUser) onAuthenticated(nextUser);
                else setMessage("Revisa tu email para confirmar el registro. Después podrás iniciar sesión y aceptar la invitación al equipo.");
                return;
              }
              let result;
              if (mode === "reset")
                result = await supabase!.auth.resetPasswordForEmail(email, {
                  redirectTo: window.location.origin + "/?recovery=1",
                });
              else if (mode === "new-password")
                result = await supabase!.auth.updateUser({ password });
              else
                result = await supabase!.auth.signInWithPassword({
                  email,
                  password,
                });
              if (result.error) setError(result.error.message);
              else if (mode === "reset")
                setMessage("Revisa tu email para recuperar el acceso.");
              else if (mode === "new-password") {
                onMessage("Contraseña actualizada");
                setMode("login");
              }
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "No se ha podido conectar. Comprueba tu conexión e inténtalo de nuevo.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {mode === "signup" && (
            <label>
              Nombre
              <input
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}
          {mode !== "new-password" && (
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          )}
          {mode !== "reset" && (
            <label>
              Contraseña
              <input
                type="password"
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          {message && (
            <div role="status" className="notice">
              {message}
            </div>
          )}
          <button className="btn primary" disabled={busy}>
            {busy
              ? "Un momento…"
              : mode === "signup"
                ? invitation ? "Crear cuenta y unirme" : "Crear cuenta"
                : mode === "reset"
                  ? "Enviar enlace"
                  : mode === "new-password"
                    ? "Actualizar contraseña"
                    : invitation ? "Entrar y unirme" : "Entrar"}
          </button>
        </form>
        <div className="auth-links">
          <button
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login" ? "Crear una cuenta" : "Volver a iniciar sesión"}
          </button>
          {mode === "login" && (
            <button onClick={() => setMode("reset")}>
              Olvidé mi contraseña
            </button>
          )}
        </div>
        {!invitation && <button className="demo-link" onClick={onDemo}>
          Explorar proyectos reales · solo lectura
        </button>}
        <a className="auth-plugin-link" href="/plugins/validacion-de-negocios">Plugin · Validación de negocios</a>
      </div>
    </div>
  );
}
function Method() {
  return (
    <div className="method-content">
      <section className="panel">
        <h2>1. Empieza por un proyecto</h2>
        <p>
          En <strong>Proyectos</strong>, crea un espacio para cada producto o
          iniciativa. Selecciona uno para trabajar con sus dos árboles:
          <strong> MVPs Tree</strong> para investigar y validar ideas de negocio
          y <strong>Growth Tree</strong> para organizar objetivos, oportunidades
          y crecimiento. Ambos utilizan el mismo proyecto, equipo e información.
        </p>
      </section>
      <section className="panel">
        <h2>2. Descubre y valida en MVPs Tree</h2>
        <div className="method-chain method-chain-mvp">
          {["Problemas u Oportunidades", "Hipótesis", "Experimentos o Investigación"].map((label,index)=>(
            <span key={label}>
              <small>0{index+1}</small>
              {label}
            </span>
          ))}
        </div>
        <p>
          <strong>Primero, identifica problemas u oportunidades</strong> de tus
          posibles clientes. Crea un registro por cada uno y añade las
          evidencias que tengas. Después, añade las <strong>hipótesis</strong>
          que intentan explicar o resolver cada problema.
        </p>
        <p>
          <strong>Comprueba las hipótesis de dos maneras:</strong> con
          <strong> Investigación</strong> (entrevistas, encuestas, observación
          o análisis documental) para obtener hallazgos cualitativos, o con
          <strong> Experimentos</strong> para probar una solución o propuesta
          y medir sus resultados. Una misma hipótesis puede tener varias
          investigaciones y experimentos asociados.
        </p>
        <p>
          El árbol muestra sus hijos por defecto. Puedes contraer o desplegar
          una rama completa con <strong>Mostrar hijos / Ocultar hijos</strong>.
          Si una hipótesis o un experimento aún no tiene vínculo, permanecerá
          visible en <strong>Sin vincular</strong> para asignarlo después.
        </p>
        <a href="/experimentacion-mvps">
          Abrir MVPs Tree <ArrowUpRight size={14} />
        </a>
      </section>
      <section className="panel">
        <h2>3. Organiza el crecimiento en Growth Tree</h2>
        <div className="method-chain">
          {[
            "North Star",
            "Objetivos + Input Metrics",
            "Oportunidades-problemas",
            "Hipótesis",
            "Experimentos",
          ].map((label,index)=>(
            <span key={label}>
              <small>0{index+1}</small>
              {label}
            </span>
          ))}
        </div>
        <p>
          Define la <strong>North Star Metric</strong> del proyecto. De ella
          dependen los <strong>Objetivos</strong> y las
          <strong> Input Metrics</strong>, situados al mismo nivel. Cada uno
          puede contener oportunidades o problemas; de estos nacen
          <strong> Hipótesis</strong> que puedes validar mediante
          <strong> Experimentos</strong>. Recorre la jerarquía con sus
          controles de hijos expandibles.
        </p>
        <p className="method-shared-trees">
          <strong>Cómo se conectan ambos árboles:</strong> los
          <strong> problemas y oportunidades</strong> y los
          <strong> experimentos</strong> son exactamente las mismas fichas en
          MVPs Tree y Growth Tree. Crear, editar o eliminar una de estas
          fichas actualiza automáticamente su visualización en ambos,
          respetando los permisos. No se duplican datos. En MVPs Tree un
          experimento se vincula a la <strong>misma hipótesis</strong> en
          Growth Tree y MVPs Tree. La relación, los comentarios y los adjuntos
          son compartidos y no se duplican.
        </p>
        <a href="/goi-tree">
          Abrir Growth Tree <ArrowUpRight size={14} />
        </a>
      </section>
      <section className="panel">
        <h2>4. Investiga y consulta la IA del proyecto</h2>
        <p>
          En <strong>IA</strong>, pregunta por problemas, hipótesis y próximos pasos.
          Desde <strong>Memoria del proyecto → Importar información</strong>,
          añade investigaciones, entrevistas, métricas y fuentes con sus fechas.
          La IA utiliza el contexto disponible, pero debes verificar sus conclusiones.
        </p>
        <p>
          Puedes dictar preguntas o adjuntar documentos al chat. Para utilizar
          la IA necesitas sesión y una conexión de OpenAI configurada
          por el administrador en Integraciones. También puedes guardar
          investigaciones como fichas dentro de MVPs Tree y vincularlas a hipótesis.
        </p>
        <a href="/guia-investigacion" target="_blank" rel="noopener noreferrer">
          Guía para investigar un mercado desde cero <ArrowUpRight size={14} />
        </a>
      </section>
      <section className="panel">
        <h2>5. Diseña un experimento verificable</h2>
        <p>
          Define la <strong>hipótesis, la métrica o evidencia principal, el
          criterio de éxito y la audiencia</strong> antes de empezar. Cuando
          corresponda, concreta también el reparto de tráfico y utiliza
          ICE (impacto, confianza y facilidad) para priorizar. Un estudio
          cualitativo puede documentarse como Investigación en MVPs Tree.
        </p>
        <p>
          Los experimentos son comunes a ambos árboles: puedes vincularlos
          a la misma hipótesis compartida en ambos árboles. Documentar una ficha no
          ejecuta por sí solo el test; debes implementarlo en tu producto
          o herramienta de experimentación.
        </p>
      </section>
      <section className="panel">
        <h2>6. Guarda y reutiliza los aprendizajes</h2>
        <p>
          Tras cada prueba, pulsa <strong>Documentar aprendizaje</strong>:
          registra resultados, evidencias, limitaciones y siguiente decisión,
          incluso si la hipótesis no se confirma. Las fichas compartidas
          conservan sus comentarios, archivos e historial de cambios en
          ambos árboles.
        </p>
        <p>
          <strong>Compartir:</strong> sin iniciar sesión se puede navegar por
          la información publicada en modo lectura. Para crear o editar,
          necesitas una cuenta y permisos. Puedes exportar tus datos desde
          tu espacio cuando tengas acceso.
        </p>
      </section>
    </div>
  );
}
function IceGuide() {
  return (
    <details className="ice-guide">
      <summary>Escalas ICE (1–10)</summary>
      <div className="ice-guide-grid">
        {["Impacto", "Confianza", "Facilidad"].map((name) => (
          <section key={name}>
            <h3>{name}</h3>
            <p>Del 1 al 10.</p>
          </section>
        ))}
      </div>
    </details>
  );
}
function PasswordRecovery({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <BrandIdentity />
        <h2>Establece tu nueva contraseña</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const r = await supabase!.auth.updateUser({ password });
            if (r.error) setMessage(r.error.message);
            else onDone();
            setBusy(false);
          }}
        >
          <label>
            Nueva contraseña
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {message && <p role="alert">{message}</p>}
          <button className="btn primary" disabled={busy}>
            Guardar contraseña
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * One shared detail layout for hypotheses in both trees. Former idea fields
 * and MVP hypothesis fields coexist without hiding or repeating any field.
 */
function HypothesisDetails({ record }: { record: Item }) {
  const groups = [
    { title: "Planteamiento", keys: ["description"] },
    { title: "Hipótesis y fundamentos", keys: ["belief", "reason"] },
    { title: "Validación", keys: ["validation_need"] },
    { title: "Indicadores y priorización", keys: ["metric", "experimental_focus", "evidence", "impact", "confidence", "ease"] },
  ];
  return <div className="hypothesis-details">
    {groups.map(group => {
      const visible = schemas.hypothesis.filter(f => group.keys.includes(f.key) &&
        record.fields[f.key] !== undefined && record.fields[f.key] !== "");
      return visible.length ? <section key={group.title} className="hypothesis-detail-section">
        <h3>{group.title}</h3>
        <FieldDetails record={record} fields={visible}/>
      </section> : null;
    })}
  </div>;
}

function FieldDetails({ record, fields }: { record: Item; fields: Field[] }) {
  return <dl className="field-details">{fields.filter(f => record.fields[f.key] !== undefined && record.fields[f.key] !== "").map(f => <div key={f.key}>
    <dt>{f.label}</dt><dd>{typeof record.fields[f.key] === "boolean" ? record.fields[f.key] ? "Sí" : "No" : String(record.fields[f.key])}</dd>
  </div>)}</dl>;
}
