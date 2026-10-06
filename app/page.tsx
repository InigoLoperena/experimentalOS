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
  Layers,
  Lightbulb,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Star,
  Target,
  Users,
  X,
  LayoutGrid,
  UserRound,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { experimentFields, experimentSections, normalizeExperiment } from "@/lib/experiments";
import { demoItems, demoMembers, demoActivity } from "@/lib/demo";
import { Avatar, ProfileDialog, type PersonalProfile } from "./profile-settings";
import { RecordAttachments } from "./record-attachments";
import { BrandIdentity } from "./brand-identity";
import { TeamAccess } from "./team-access";
import { BackupDialog, type BackupFormat } from "./backup-dialog";
import { PostHogResults } from "./posthog-results";
import type { Backup } from "@/lib/backup";
import { fetchBackup } from "@/lib/backup-service";
import { getPublicPreview, openTeamSpace } from "@/lib/internal-space";
import { attachmentBucket, supportsAttachments, type Attachment } from "@/lib/attachments";
import { cleanupAttachments } from "@/lib/attachment-service";
import {
  ancestors,
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
type View = "experiments" | "projects" | "learning" | "team" | "map" | "method";
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
    ...numberFields,
    {
      key: "stage",
      label: "Etapa del Product Hackers Canvas (editable)",
      required: true,
    },
  ],
  opportunity: [
    {
      key: "opportunity_type",
      label: "Tipo",
      type: "select",
      options: ["Problema", "Oportunidad"],
    },
    {
      key: "evidence",
      label: "Evidencia del problema o la oportunidad",
      type: "textarea",
      required: true,
    },
    { key: "source", label: "Fuente / enlace de la evidencia" },
    {
      key: "stage",
      label: "Etapa del Product Hackers Canvas (editable)",
      required: true,
    },
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
    { key: "stage", label: "Etapa del Product Hackers Canvas", required: true },
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
const nav: { id: View; label: string; icon: typeof Star }[] = [
  { id: "experiments", label: "Experimentos", icon: FlaskConical },
  { id: "projects", label: "Proyectos", icon: LayoutGrid },
  { id: "learning", label: "Aprendizajes", icon: Lightbulb },
  { id: "team", label: "Equipo", icon: Users },
  { id: "map", label: "GOI Tree", icon: GitBranch },
  { id: "method", label: "Cómo utilizar Experimental OS", icon: BookOpen },
];
function IconFor({ kind }: { kind: Kind }) {
  const I =
    kind === "north_star"
      ? Star
      : kind === "experiment"
        ? FlaskConical
        : kind === "idea"
          ? Lightbulb
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
    "greenhunt store": "/project-logos/greenhunt.png",
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
const defaultProjectDescriptions: Record<string, string> = {
  greenhunt:
    "Marketplace de economía circular para descubrir y compartir objetos reutilizables, ventas y oportunidades locales. Conecta oferta y demanda para dar una segunda vida a objetos que aún tienen valor.",
  greenroute:
    "Plataforma para optimizar rutas y operaciones de recogida, reduciendo kilómetros, tiempo y costes. Ayuda a los equipos de campo a planificar y ejecutar rutas más eficientes.",
  smartjunk:
    "Marketplace de recogida de muebles y objetos donde particulares publican solicitudes y recolectores o empresas pujan por realizarlas. Centraliza la contratación, coordinación y gestión de cada recogida.",
  booklinks:
    "Plataforma para crear y compartir colecciones de enlaces organizadas de forma simple y accesible. Convierte recursos dispersos en listados útiles y fáciles de consultar.",
};
function projectDescription(project: Item) {
  return (
    String(project.fields.description || "").trim() ||
    defaultProjectDescriptions[project.title.trim().toLowerCase()] ||
    "Añade una breve propuesta de valor para explicar en dos líneas qué hace este proyecto y por qué resulta útil."
  );
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
  const [view, setView] = useState<View>("map");
  const [allItems, setItems] = useState<Item[]>([]);
  const [projectId, setProjectId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [publicMode, setPublicMode] = useState(false);
  const [authRequested, setAuthRequested] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [profile, setProfile] = useState<PersonalProfile>({ name: "Miembro" });
  const [profileReady, setProfileReady] = useState(!supabase);
  const [showProfile, setShowProfile] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [demo, setDemo] = useState(!supabase);
  const [loading, setLoading] = useState(!!supabase);
  const [toast, setToast] = useState("");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Item | null>(null);
  const [draft, setDraft] = useState<Item | null>(null);
  const [saving, setSaving] = useState(false);
  const [attachmentsBusy, setAttachmentsBusy] = useState(false);
  const [demoAttachments, setDemoAttachments] = useState<Record<string, Attachment[]>>({});
  const [publicAttachments, setPublicAttachments] = useState<Attachment[]>([]);
  const [newKind, setNewKind] = useState<Kind>("experiment");
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
  const projectScoped = ["map", "experiments", "learning"].includes(view);
  const availableKinds: Kind[] =
    view === "projects"
      ? ["project"]
      : view === "learning"
        ? ["learning"]
        : view === "experiments"
          ? ["experiment"]
          : view === "map"
            ? ["north_star", "goal", "opportunity", "idea", "experiment"]
            : [];
  const createKind = availableKinds.includes(newKind)
    ? newKind
    : availableKinds[0];
  const dialog = useRef<HTMLDialogElement>(null);
  const detail = useRef<HTMLDialogElement>(null);
  const loadVersion = useRef(0);
  const role = publicMode
    ? "viewer"
    : demo
      ? "owner"
      : members.find((m) => m.user_id === user?.id)?.role;
  const editable = role === "owner" || role === "editor";
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
      setLoading(false);
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
      setItems(structuredClone(demoItems).map(normalizeExperiment));
      setMembers(demoMembers);
      setActivity(demoActivity);
      setLoading(false);
      return;
    }
    if (!user) {
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
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        if (pendingInvite) {
          const joined = await supabase!.rpc("join_workspace", { invite_token: pendingInvite });
          if (joined.error) throw new Error(joined.error.message);
          if (!joined.data) throw new Error("La invitación ya no es válida.");
          preferredWorkspace.current = joined.data as string;
          if (alive) {
            setWorkspace({ id: joined.data as string, name: invitationPreview?.team_name });
            setPendingInvite("");
            setInvitationPreview(null);
            window.history.replaceState({}, "", window.location.pathname);
            tell("Te has unido al equipo");
          }
          return;
        }

        if (preferredWorkspace.current) {
          const id = preferredWorkspace.current;
          preferredWorkspace.current = null;
          if (alive) setWorkspace((current) => current?.id === id ? current : { id });
          return;
        }

        const space = await openTeamSpace(supabase!);
        if (alive) { setWorkspace(space); setError(""); }
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
      supabase!
        .from("records")
        .select("*")
        .eq("workspace_id", w.id)
        .order("created_at"),
      supabase!
        .from("members")
        .select("user_id,role,profiles(*)")
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
        user_id: m.user_id, role: m.role,
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
      if (workspace) void load(workspace);
    }
  }, [workspace?.id, demo]);
  useEffect(() => {
    if (draft) {
      dialog.current?.showModal();
    } else dialog.current?.close();
  }, [draft]);
  useEffect(() => {
    if (selected) detail.current?.showModal();
    else detail.current?.close();
  }, [selected]);
  function create(kind: Kind, parent_id: string | null = null) {
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
    setError("");
    const defaults = Object.fromEntries(
      schemas[kind]
        .filter((f) => f.type === "select")
        .map((f) => [f.key, f.options?.[0] || ""]),
    );
    const parent = items.find((item) => item.id === parent_id);
    const goal = parent
      ? ancestors(parent, items)
          .slice()
          .reverse()
          .find((item) => item.kind === "goal")
      : null;
    const contextFields: Fields =
      kind === "idea"
        ? {
            metric: goal?.fields.metric || "",
            stage: parent?.fields.stage || goal?.fields.stage || "",
            evidence: parent?.fields.evidence || "",
          }
        : kind === "experiment"
          ? {
              context: parent?.fields.description || "",
              metric: parent?.fields.metric || "",
            }
          : kind === "learning"
            ? {
                context: parent?.fields.context || "",
                tags: parent?.fields.tags || "",
              }
            : {};
    setDraft({
      id: crypto.randomUUID(),
      workspace_id: workspace.id,
      project_id: kind === "project" ? null : currentProject!.id,
      kind,
      parent_id,
      related_id: null,
      title: "",
      owner_id: demo ? "demo-user" : user?.id || null,
      fields: {
        ...defaults,
        ...contextFields,
        ...(kind === "experiment"
          ? {
              impact: 5,
              confidence: 5,
              ease: 5,
            }
          : kind === "idea"
            ? { impact: 5, confidence: 5, ease: 5 }
            : {}),
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: user?.id || null,
      updated_by: user?.id || null,
    });
  }
  async function save() {
    if (!draft || saving || attachmentsBusy) return;
    if (!demo && !schemaReady) {
      setError(
        "Completa primero la actualización de Supabase indicada en el repositorio.",
      );
      return;
    }
    const record = normalizeExperiment(draft);
    const problem = validate(record);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
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
    if (demo) {
      setItems((prev) =>
        exists
          ? prev.map((i) => (i.id === record.id ? record : i))
          : [...prev, record],
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
        setView("map");
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
      parent_id: draft.parent_id,
      related_id: draft.related_id,
      fields: record.fields,
      project_id: record.project_id,
    };
    const q = exists
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
      setError(r.error.message);
    } else if (!r.data?.length) {
      setError(
        "Otra persona ha modificado este registro. Cierra el formulario y actualiza antes de editar.",
      );
    } else {
      if (record.kind === "project") {
        setProjectId(record.id);
        setView("map");
      }
      setDraft(null);
      tell("Cambios guardados");
      await load();
      if (supportsAttachments(record.kind)) setSelected(normalizeExperiment(r.data[0] as Item));
    }
    setSaving(false);
  }
  async function exportData(format: BackupFormat, originals: boolean, progress: (message: string) => void) {
    if (!workspace) throw new Error("Abre el equipo antes de exportar.");
    const snapshot: Backup = demo ? {
      schema_version: 4, exported_at: new Date().toISOString(), workspace_id: workspace.id,
      records: structuredClone(workspaceItems), members: structuredClone(members), audit: structuredClone(activity) as unknown as Record<string, unknown>[],
      attachments: workspaceItems.flatMap(record => demoAttachments[record.id] || []).map(({ preview_url, ...attachment }) => attachment),
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
    }, progress);
    tell("Copia completa descargada");
  }
  const experiments = items.filter((i) => i.kind === "experiment");
  const nsm = items.find((i) => i.kind === "north_star");
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
  function itemCard(i: Item) {
    return (
      <button className="record-card" key={i.id} onClick={() => setSelected(i)}>
        <div className="row">
          <span className={"kind " + i.kind}>
            <IconFor kind={i.kind} />
            {kinds[i.kind]}
          </span>
          {i.kind === "opportunity" && i.fields.focus && (
            <span className="focus">Prioritaria</span>
          )}
        </div>
        <strong>{i.title}</strong>
        {["goal", "kr"].includes(i.kind) && (
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
        {i.kind === "idea" && (
          <span className="small">
            ICE {score(i.fields)} ·{" "}
            {items.filter((x) => x.parent_id === i.id).length} experimentos
          </span>
        )}
        {i.kind === "experiment" && (
          <div className="row">
            <span className="small">
              {i.owner_id ? author(i.owner_id) : "Sin asignar"}
            </span>
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
        {itemCard(i)}
        {children.length > 0 && (
          <details open={i.kind !== "idea"}>
            <summary>
              <ChevronRight size={14} />
              {children.length} elementos
            </summary>
            <div className="branch-children">{children.map(branch)}</div>
          </details>
        )}
        {editable && i.kind === "goal" && (
          <button className="add-node" onClick={() => create("goal", i.id)}>
            <Plus size={14} /> Añadir sub-Goal
          </button>
        )}
        {editable && ["goal", "opportunity", "idea"].includes(i.kind) && (
          <button
            className="add-node"
            onClick={() =>
              create(
                i.kind === "goal"
                  ? "opportunity"
                  : i.kind === "opportunity"
                    ? "idea"
                    : "experiment",
                i.id,
              )
            }
          >
            <Plus size={14} />
            {i.kind === "goal"
              ? "Añadir oportunidad"
              : i.kind === "opportunity"
                ? "Añadir idea"
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
            title: "Consultar el GOI Tree del proyecto",
            description:
              "Lee los registros visibles del proyecto seleccionado, con North Star, GOI Tree, experimentos y aprendizajes.",
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
  const draftFields = (links?: ReactNode) => draft && schemas[draft.kind].map((f) => (
                <Fragment key={f.key}>
                {draft.kind === "experiment" && f.key === "impact" && <h3 className="full experiment-ice-title">ICE</h3>}
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
                          required={f.required}
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
                {draft.kind === "experiment" && f.key === "ease" && <div className="full">{links}</div>}
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
          }}>Ir a Experimental OS</button>
        </div>
      </div>
    );
  if (loading && !workspace)
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <BrandIdentity />
          <h1>Cargando tu espacio…</h1>
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
        onDemo={() => { setAuthRequested(false); setDemo(true); }}
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
        setWorkspace(await openTeamSpace(supabase!));
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
            setView("map");
          }}
        >
          <BrandIdentity />
        </a>
        <span className="nav-caption">ESPACIO DE TRABAJO</span>
        <nav>
          {nav.map(({ id, label, icon: I }) => (
            <button
              key={id}
              className={view === id ? "active" : ""}
              onClick={() => {
                setView(id);
                setFilter("");
              }}
            >
              <I size={18} />
              {label}
              {id === "experiments" && (
                <span className="nav-count">{experiments.length}</span>
              )}
            </button>
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
                  ? "Administrador"
                  : role === "editor"
                    ? "Editor"
                    : "Lector"}
              </span>
            </div>
            <button aria-label="Editar mi perfil" title="Editar mi perfil" onClick={() => publicMode ? requestAuth("signup") : setShowProfile(true)}><UserRound size={17} /></button>
            <button
              aria-label="Salir"
              onClick={async () => {
                if (demo) {
                  setDemo(false);
                  if (!supabase) setDemo(true);
                  else setWorkspace(null);
                } else {
                  await supabase!.auth.signOut();
                }
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <button className="icon-button" aria-label="Mi perfil" title="Mi perfil" onClick={() => publicMode ? requestAuth("signup") : setShowProfile(true)}><UserRound size={17} /></button>
            <span>Equipo interno</span>
            <ChevronRight size={14} />
            <strong>{nav.find((n) => n.id === view)?.label}</strong>
          </div>
          <div>
            {publicMode
              ? <button className="btn primary export-trigger" onClick={() => requestAuth("signup")}><UserRound size={16} /><span>Crear mi espacio</span></button>
              : <button className="btn primary export-trigger" onClick={() => setShowBackup(true)}><Download size={16} /><span>Exportar</span></button>}
            <span className="top-status">
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
          {publicMode && (
            <div className="demo-banner">
              <span>
                <strong>Vista pública.</strong> Estás viendo los proyectos y experimentos reales publicados por Imagine Builder en modo solo lectura.
              </span>
              <button onClick={() => requestAuth("signup")}>Crear mi propio espacio</button>
            </div>
          )}
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
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {view === "map" ? "ESTRATEGIA EN ACCIÓN" : "LABORATORIO"}
              </span>
              <h1>{nav.find((n) => n.id === view)?.label}</h1>
              <p>
                {view === "map"
                  ? "La arquitectura de información diseñada para maximizar la generación de ideas de Growth con la máxima calidad, contexto, fundamento y orden."
                  : view === "experiments"
                    ? "Documenta qué vas a probar y cómo sabrás si funciona."
                    : view === "learning"
                      ? "Guarda lo que ocurrió, lo que aprendiste y qué harás después."
                      : view === "team"
                        ? "Gestiona las personas y sus permisos en el sistema."
                        : view === "projects"
                          ? "Cada proyecto tiene su propio GOI Tree, experimentos y aprendizajes."
                          : "Una guía sencilla para empezar a trabajar."}
              </p>
            </div>
            {editable && createKind && (!projectScoped || currentProject) && (
              <div className="create-control">
                <select
                  aria-label="Tipo de nuevo registro"
                  value={createKind}
                  onChange={(e) => setNewKind(e.target.value as Kind)}
                >
                  {availableKinds.map((k) => (
                    <option key={k} value={k}>
                      {kinds[k]}
                    </option>
                  ))}
                </select>
                <Action className="primary" onClick={() => create(createKind)}>
                  <Plus size={17} /> Crear
                </Action>
              </div>
            )}
          </div>
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
            </div>
          )}
          {projectScoped && !currentProject && (
            <Empty
              title="Empieza creando un proyecto"
              text="Cada proyecto tendrá su propio GOI Tree, experimentos y aprendizajes."
              action={editable ? () => create("project") : undefined}
            />
          )}
          {view === "map" && currentProject && (
            <>
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
                  label="Ideas por explorar"
                  value={items.filter((i) => i.kind === "idea").length}
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
                <button className="north-star" onClick={() => setSelected(nsm)}>
                  <div className="north-icon">
                    <Star size={28} />
                  </div>
                  <div className="north-content">
                    <span>NORTH STAR METRIC</span>
                    <h2>{nsm.title}</h2>
                    <p>
                      {String(
                        nsm.fields.definition ||
                          "Define cómo se mide el valor que recibe el usuario.",
                      )}
                    </p>
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
                  action={editable ? () => create("north_star") : undefined}
                />
              )}
              <div className="section-heading">
                <div>
                  <h2>GOI Tree · {currentProject.title}</h2>
                  <p>Goals · oportunidades · ideas · experimentos</p>
                </div>
                {editable && nsm && (
                  <Action onClick={() => create("goal", nsm.id)}>
                    <Plus size={16} /> Nuevo Goal
                  </Action>
                )}
              </div>
              <div className="goi-grid">
                {goals
                  .filter((g) => g.parent_id === nsm?.id)
                  .map((g) => (
                    <section className="goal-column" key={g.id}>
                      {itemCard(g)}
                      <details open className="goal-content">
                        <summary>
                          <ChevronRight size={14} /> Oportunidades y sub-Goals
                        </summary>
                        {items.filter((i) => i.parent_id === g.id).map(branch)}
                        {editable && (
                          <button
                            className="add-node"
                            onClick={() => create("goal", g.id)}
                          >
                            <Plus size={14} /> Añadir sub-Goal
                          </button>
                        )}
                        {editable && (
                          <button
                            className="add-node"
                            onClick={() => create("opportunity", g.id)}
                          >
                            <Plus size={14} /> Añadir oportunidad
                          </button>
                        )}
                      </details>
                    </section>
                  ))}
              </div>
              {nsm && !goals.length && (
                <Empty
                  title="Encuentra las palancas de crecimiento"
                  text="Añade Goals medibles que puedan mover tu North Star."
                />
              )}
              <div className="section-heading">
                <div>
                  <h2>Orden de ejecución</h2>
                  <p>
                    Prioriza las ideas y experimentos de este proyecto con ICE:
                    impacto × confianza × facilidad.
                  </p>
                </div>
              </div>
              <IceGuide />
              <div className="priority-list">
                {items
                  .filter((i) => ["idea", "experiment"].includes(i.kind))
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
                  <i className="legend-dot idea" /> Idea
                </span>
                <span>
                  <i className="legend-dot experiment" /> Experimento
                </span>
                <span>Haz clic en un elemento para ver su ficha</span>
              </div>
            </>
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
                            {e.title}
                            <span>
                              {e.fields.metric || "Métrica pendiente"}
                            </span>
                          </button>
                        </td>
                        <td>
                          {e.owner_id ? author(e.owner_id) : "Sin asignar"}
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
                        setView("map");
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
                    {
                      workspaceItems.filter(
                        (e) => e.kind === "experiment" && e.project_id === p.id,
                      ).length
                    }{" "}
                    experimentos
                  </p>
                  <div className="row">
                    <Action
                      onClick={() => {
                        setProjectId(p.id);
                        setView("map");
                      }}
                    >
                      Abrir GOI Tree
                    </Action>
                    {editable && (
                      <Action onClick={() => setSelected(p)}>
                        Editar proyecto
                      </Action>
                    )}
                  </div>
                </section>
              ))}
              {!projects.length && (
                <Empty
                  title="Crea tu primer proyecto"
                  text="Organiza cada producto o iniciativa con su propio árbol y experimentos."
                  action={editable ? () => create("project") : undefined}
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
                  action={editable ? () => create("learning") : undefined}
                />
              )}
            </div>
          )}
          {view === "team" && (
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
                {members.map((m) => (
                  <div className="member-row" key={m.user_id}>
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
                          ? "Administrador"
                          : m.role === "editor"
                            ? "Editor"
                            : "Lector"}
                      </span>
                    )}
                  </div>
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
                      <option value="editor">Editor · crear y editar</option>
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
          <footer className="footer">
            <span>Experimental Operative System · Imagine Builder</span>
            <button onClick={() => publicMode ? requestAuth("signup") : setShowBackup(true)}>
              {publicMode ? "Crear mi propio espacio" : "Exportar copia completa"}
            </button>
          </footer>
        </main>
      </div>
      {profileEditor}
      {showBackup && <BackupDialog onClose={() => setShowBackup(false)} onExport={exportData} />}
      <dialog
        ref={detail}
        className="detail-dialog"
        onCancel={e => { if (attachmentsBusy) e.preventDefault(); else setSelected(null); }}
        onClick={(e) => {
          if (!attachmentsBusy && e.target === detail.current) setSelected(null);
        }}
      >
        {selected && (
          <div className="detail-content">
            <div className="row">
              <span className={"kind " + selected.kind}>
                <IconFor kind={selected.kind} />
                {kinds[selected.kind]}
              </span>
              <button
                className="icon-button"
                aria-label="Cerrar ficha"
                disabled={attachmentsBusy}
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
            <h2>{selected.title}</h2>
            <div className="row detail-meta">
              <span>
                Responsable:{" "}
                {selected.owner_id ? author(selected.owner_id) : "Sin asignar"}
              </span>
              {selected.kind !== "experiment" && selected.fields.status && (
                <Badge state={selected.fields.status} />
              )}
            </div>
            {editable && (demo || schemaReady) && (
              <Action
                className="primary"
                disabled={attachmentsBusy}
                onClick={() => {
                  setDraft(structuredClone(selected));
                  setSelected(null);
                  setError("");
                }}
              >
                Editar ficha
              </Action>
            )}
            {selected.kind === "experiment" && editable && (
              <Action
                disabled={attachmentsBusy}
                onClick={() => {
                  create("learning", selected.id);
                  setSelected(null);
                }}
              >
                Documentar aprendizaje
              </Action>
            )}
            {supportsAttachments(selected.kind) ? <RecordAttachments key={selected.id}
              record={selected} editable={editable} demo={demo} prefetched={publicMode} values={publicMode ? publicAttachments.filter(a => a.record_id === selected.id) : (demoAttachments[selected.id] || [])}
              onDemoChange={values => setDemoAttachments(prev => ({ ...prev, [selected.id]: values }))} onBusy={setAttachmentsBusy}>
              {({ links, files }) => selected.kind === "experiment" ? <>
                <FieldDetails record={selected} fields={experimentSections.primary} />
                <PostHogResults experiment={selected} project={currentProject} />
                <section className="experiment-ice"><h3>ICE</h3><FieldDetails record={selected} fields={experimentSections.ice} /></section>
                {links}
                <FieldDetails record={selected} fields={experimentSections.additional} />
                {files}
              </> : <><FieldDetails record={selected} fields={schemas[selected.kind]} />{links}{files}</>}
            </RecordAttachments> : <FieldDetails record={selected} fields={schemas[selected.kind]} />}
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
          if (saving || attachmentsBusy) e.preventDefault(); else setDraft(null);
        }}
      >
        {draft && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div className="dialog-head">
              <div>
                <span className="eyebrow">
                  {allItems.some((i) => i.id === draft.id) ? "EDITAR" : "CREAR"}{" "}
                  {kinds[draft.kind].toUpperCase()}
                </span>
                <h2>{draft.title || "Nueva ficha"}</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Cerrar formulario"
                disabled={saving || attachmentsBusy}
                onClick={() => setDraft(null)}
              >
                <X />
              </button>
            </div>
            <div className="form-body">
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
              {draft.kind !== "experiment" && parents[draft.kind] && (
                <label>
                  {draft.kind === "goal"
                    ? "North Star o Goal padre"
                    : kinds[parents[draft.kind]!] + " al que pertenece"}
                  <select
                    required={draft.kind !== "learning"}
                    value={draft.parent_id || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, parent_id: e.target.value || null })
                    }
                  >
                    <option value="">Seleccionar…</option>
                    {items
                      .filter(
                        (i) =>
                          (i.kind === parents[draft.kind] ||
                            (draft.kind === "goal" && i.kind === "goal")) &&
                          i.id !== draft.id &&
                          !ancestors(i, items).some((a) => a.id === draft.id),
                      )
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.title}
                        </option>
                      ))}
                  </select>
                </label>
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
                record={draft} editable={editable && !saving} demo={demo} prefetched={publicMode} values={publicMode ? publicAttachments.filter(a => a.record_id === draft.id) : (demoAttachments[draft.id] || [])}
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
                disabled={saving || attachmentsBusy}
                onClick={() => setDraft(null)}
              >
                Cancelar
              </button>
              <button type="submit" className="btn primary" disabled={saving || attachmentsBusy}>
                {saving ? "Guardando…" : "Guardar ficha"}
              </button>
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
          Cada idea merece
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
          <span>GOI Tree</span>
          <span>Experimentos</span>
        </div>
      </div>
      <div className="auth-card">
        <div className="auth-mobile-brand"><BrandIdentity /></div>
        <span className="eyebrow">EXPERIMENTAL OPERATIVE SYSTEM</span>
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
                const { data, error: signupError } =
                  await supabase!.auth.signUp({
                    email: email.trim(),
                    password,
                    options: { data: { name: name.trim() } },
                  });
                if (signupError) setError(signupError.message);
                else if (data.session) onAuthenticated(data.session.user);
                else {
                  const signedIn = await supabase!.auth.signInWithPassword({
                    email: email.trim(),
                    password,
                  });
                  if (signedIn.error || !signedIn.data.session)
                    setError(
                      "La cuenta se ha creado, pero el inicio de sesión automático no está disponible. Revisa la configuración de confirmación de email.",
                    );
                  else onAuthenticated(signedIn.data.session.user);
                }
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
            } catch {
              setError(
                "No se ha podido conectar. Comprueba tu conexión e inténtalo de nuevo.",
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
        <button className="demo-link" onClick={onDemo}>
          Explorar la demostración
        </button>
      </div>
    </div>
  );
}
function Method() {
  return (
    <div className="method-content">
      <section className="panel">
        <h2>Empieza por un proyecto</h2>
        <p>
          Crea un proyecto para cada producto o iniciativa. Después,
          selecciónalo en Experimentos, Aprendizajes o GOI Tree. Cada
          proyecto conserva sus propias fichas y su propio árbol.
        </p>
      </section>
      <section className="panel">
        <h2>Experimentos: probar una hipótesis</h2>
        <p>
          Un experimento comprueba si un cambio produce el efecto que esperamos.
          Antes de probarlo, escribe qué cambiarás, a quién afecta, qué métrica
          observarás y qué resultado considerarás un éxito.
        </p>
        <p>
          Asigna un responsable, documenta el reparto de tráfico, los riesgos y la
          fecha de inicio. Usa impacto, confianza y facilidad para decidir qué
          probar primero. La aplicación documenta el experimento; la prueba se
          ejecuta en tu producto o herramienta habitual.
        </p>
      </section>
      <section className="panel">
        <h2>Aprendizajes: conservar lo que descubrimos</h2>
        <p>
          Después de la prueba, abre el experimento y pulsa «Documentar
          aprendizaje». Escribe qué ocurrió, adjunta la evidencia, explica qué
          aprendiste y decide qué harás después. Si el resultado no es
          concluyente, deja constancia de ello.
        </p>
        <p>
          Los aprendizajes se guardan por separado, dentro del mismo proyecto.
          Usa etiquetas para encontrarlos y reutilizarlos.
        </p>
      </section>
      <section className="panel">
        <h2>GOI Tree: conectar las ideas con el crecimiento</h2>
        <p>La arquitectura de información diseñada para maximizar la generación de ideas de Growth con la máxima calidad, contexto, fundamento y orden.</p>
        <div className="method-chain">
          {[
            "North Star",
            "Goals",
            "Oportunidades",
            "Ideas",
            "Experimentos",
          ].map((label, index) => (
            <span key={label}>
              <small>0{index + 1}</small>
              {label}
            </span>
          ))}
        </div>
        <p>
          La North Star mide el valor que recibe el usuario. Los Goals son
          métricas de entrada que pueden moverla; puedes dividirlos en
          sub-Goals. Las oportunidades describen problemas reales o mejoras que
          todavía no se están aprovechando.
        </p>
        <p>
          Documenta las oportunidades y destaca un máximo de cinco por proyecto.
          Añade ideas concretas, relacionadas con una métrica y una etapa del
          Product Hackers Canvas. Priorízalas con ICE. Una idea puede dar lugar
          a varios experimentos, cada uno con su propia hipótesis.
        </p>
        <p>
          Usa nombres claros y descriptivos. Abre o pliega las ramas para
          recorrer el árbol sin perder el contexto.
        </p>
        <p>Abre una ficha del árbol para adjuntar capturas, imágenes, PDF, DOCX o enlaces que aporten contexto y evidencia. También puedes hacerlo en Experimentos y Aprendizajes.</p>
        <a
          href="https://producthackers.com/es/blog/que-es-goi-tree/"
          target="_blank"
          rel="noreferrer"
        >
          Cómo funciona GOI Tree · Product Hackers <ArrowUpRight size={14} />
        </a>
        <a
          href="https://producthackers.com/es/blog/guia-north-star-metric/"
          target="_blank"
          rel="noreferrer"
        >
          Guía North Star Metric · Product Hackers <ArrowUpRight size={14} />
        </a>
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

function FieldDetails({ record, fields }: { record: Item; fields: Field[] }) {
  return <dl className="field-details">{fields.filter(f => record.fields[f.key] !== undefined && record.fields[f.key] !== "").map(f => <div key={f.key}>
    <dt>{f.label}</dt><dd>{typeof record.fields[f.key] === "boolean" ? record.fields[f.key] ? "Sí" : "No" : String(record.fields[f.key])}</dd>
  </div>)}</dl>;
}
