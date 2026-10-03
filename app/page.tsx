"use client";
import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
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
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { experimentFields, normalizeExperiment } from "@/lib/experiments";
import { demoItems, demoMembers, demoActivity } from "@/lib/demo";
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
type Workspace = { id: string; name: string };
type Invitation = {
  id: string;
  token: string;
  role: string;
  expires_at: string;
  used_by: string | null;
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
    { key: "site_url", label: "Web del proyecto" },
    { key: "north_star", label: "North Star Metric" },
    { key: "analytics_url", label: "Enlace a Analytics" },
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
  { id: "map", label: "Growth Tree", icon: GitBranch },
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
export default function Home() {
  const [view, setView] = useState<View>("map");
  const [allItems, setItems] = useState<Item[]>([]);
  const [projectId, setProjectId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [demo, setDemo] = useState(!supabase);
  const [loading, setLoading] = useState(!!supabase);
  const [toast, setToast] = useState("");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Item | null>(null);
  const [draft, setDraft] = useState<Item | null>(null);
  const [saving, setSaving] = useState(false);
  const [newKind, setNewKind] = useState<Kind>("experiment");
  const [inviteRole, setInviteRole] = useState("editor");
  const [inviteUrl, setInviteUrl] = useState("");
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [error, setError] = useState("");
  const [schemaReady, setSchemaReady] = useState(true);
  const [recovery, setRecovery] = useState(false);
  const [pendingInvite, setPendingInvite] = useState("");
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
  const role = demo
    ? "owner"
    : members.find((m) => m.user_id === user?.id)?.role;
  const editable = role === "owner" || role === "editor";
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("recovery")) setRecovery(true);
    setPendingInvite(params.get("invite") || "");
  }, []);
  const tell = (s: string) => {
    setToast(s);
    window.setTimeout(() => setToast(""), 5000);
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
      setWorkspace({ id: "demo", name: "Greenhunt · ejemplo" });
      setItems(structuredClone(demoItems).map(normalizeExperiment));
      setMembers(demoMembers);
      setActivity(demoActivity);
      setLoading(false);
      return;
    }
    if (!user) {
      setWorkspace(null);
      setItems([]);
      setMembers([]);
      setActivity([]);
      setWorkspaces([]);
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      const r = await supabase!
        .from("workspaces")
        .select("id,name")
        .order("created_at");
      if (!alive) return;
      if (r.error) setError(r.error.message);
      else {
        setWorkspaces(r.data || []);
        setWorkspace(
          (prev) =>
            r.data?.find((w) => w.id === prev?.id) || r.data?.[0] || null,
        );
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [user, demo]);
  async function load(w = workspace) {
    if (!w || demo) return;
    setLoading(true);
    const r = await Promise.all([
      supabase!
        .from("records")
        .select("*")
        .eq("workspace_id", w.id)
        .order("created_at"),
      supabase!
        .from("members")
        .select("user_id,role,profiles(name)")
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
    ]);
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
      setMembers(
        (r[1].data || []).map((m: any) => ({
          user_id: m.user_id,
          role: m.role,
          name: m.profiles?.name || "Miembro",
        })),
      );
      setActivity(r[2].data || []);
      setInvitations(r[3].data || []);
      setError("");
    }
    setLoading(false);
  }
  useEffect(() => {
    if (workspace && !demo) void load(workspace);
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
    if (!draft) return;
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
    }
    setSaving(false);
  }
  async function exportData() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            schema_version: 2,
            exported_at: new Date().toISOString(),
            workspace,
            project: projectScoped ? currentProject : null,
            records: projectScoped ? items : workspaceItems,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "experimental-os-export.json";
    a.click();
    URL.revokeObjectURL(url);
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
  if (loading && !workspace)
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <Star className="brand-star" />
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
  if (!user && !demo)
    return (
      <Auth
        onDemo={() => setDemo(true)}
        onMessage={tell}
        onAuthenticated={setUser}
      />
    );
  if (!workspace)
    return (
      <WorkspaceSetup
        onCreated={async () => {
          const r = await supabase!.from("workspaces").select("id,name");
          setWorkspaces(r.data || []);
          setWorkspace(r.data?.[0] || null);
        }}
      />
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
          <span className="brand-symbol">
            <Star size={19} />
          </span>
          <span>
            experimental<span className="brand-os">OS</span>
          </span>
        </a>
        <div className="workspace-switch">
          <span className="workspace-avatar">{workspace.name[0]}</span>
          <div>
            <strong>{workspace.name}</strong>
            <span>Laboratorio de crecimiento</span>
          </div>
          {workspaces.length > 1 && (
            <select
              aria-label="Empresa"
              value={workspace.id}
              onChange={(e) =>
                setWorkspace(
                  workspaces.find((w) => w.id === e.target.value) || null,
                )
              }
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          )}
        </div>
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
          <div className="cycle">
            <span className="small">CICLO ACTUAL</span>
            <strong>Aprender. Decidir. Repetir.</strong>
            <div className="cycle-line">
              <span />
              <span />
              <span />
            </div>
          </div>
          <div className="profile">
            <span className="avatar">{author(user?.id || "demo-user")[0]}</span>
            <div>
              <strong>
                {demo ? "Sesión de ejemplo" : author(user?.id || null)}
              </strong>
              <span>
                {role === "owner"
                  ? "Propietario"
                  : role === "editor"
                    ? "Editor"
                    : "Lector"}
              </span>
            </div>
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
            <span>Empresa</span>
            <ChevronRight size={14} />
            <strong>{nav.find((n) => n.id === view)?.label}</strong>
          </div>
          <div>
            <span className="top-status">
              {demo ? "Datos de ejemplo" : "Espacio compartido"}
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
          {pendingInvite && !demo && (
            <div className="notice row">
              <span>Tienes una invitación para unirte a una empresa.</span>
              <Action
                onClick={async () => {
                  const r = await supabase!.rpc("join_workspace", {
                    invite_token: pendingInvite,
                  });
                  if (r.error) tell(r.error.message);
                  else {
                    const w = await supabase!
                      .from("workspaces")
                      .select("id,name");
                    setWorkspaces(w.data || []);
                    setWorkspace(w.data?.find((x) => x.id === r.data) || null);
                    setPendingInvite("");
                    window.history.replaceState(
                      {},
                      "",
                      window.location.pathname,
                    );
                  }
                }}
              >
                Aceptar invitación
              </Action>
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
                {supabase ? "Acceder a mi empresa" : "Cómo activar mi empresa"}
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
                  ? "De la North Star a los Goals, oportunidades, ideas y experimentos de este proyecto."
                  : view === "experiments"
                    ? "Documenta qué vas a probar y cómo sabrás si funciona."
                    : view === "learning"
                      ? "Guarda lo que ocurrió, lo que aprendiste y qué harás después."
                      : view === "team"
                        ? "Personas y acceso a tu empresa."
                        : view === "projects"
                          ? "Cada proyecto tiene su propio Growth Tree, experimentos y aprendizajes."
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
                <span>
                  {currentProject.fields.description ||
                    "Growth Tree, experimentos y aprendizajes independientes."}
                </span>
              )}
            </div>
          )}
          {projectScoped && !currentProject && (
            <Empty
              title="Empieza creando un proyecto"
              text="Cada proyecto tendrá su propio Growth Tree, experimentos y aprendizajes."
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
                  <h2>Growth Tree · {currentProject.title}</h2>
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
                    placeholder="Buscar por nombre, champion, hipótesis o etiquetas…"
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
                      <th>Champion</th>
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
                  <button
                    className="plain-heading"
                    onClick={() => {
                      setProjectId(p.id);
                      setView("map");
                      setFilter("");
                    }}
                  >
                    <span className="eyebrow">PROYECTO</span>
                    <h2>{p.title}</h2>
                    <p>{p.fields.description}</p>
                  </button>
                  <p className="small">
                    {
                      workspaceItems.filter(
                        (e) => e.kind === "experiment" && e.project_id === p.id,
                      ).length
                    }{" "}
                    experimentos · {author(p.owner_id)}
                  </p>
                  <div className="row">
                    <Action
                      onClick={() => {
                        setProjectId(p.id);
                        setView("map");
                      }}
                    >
                      Abrir Growth Tree
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
                  <h2>Miembros de la empresa</h2>
                  <span>{members.length} personas</span>
                </div>
                {members.map((m) => (
                  <div className="member-row" key={m.user_id}>
                    <span className="avatar">{m.name[0]}</span>
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
                                  " a esta empresa? Sus acciones permanecerán en el historial.",
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
                          ? "Propietario"
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
                    El enlace es de un solo uso y caduca en 7 días. La persona
                    crea su propia cuenta antes de unirse.
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
              {!demo && (
                <div className="panel">
                  <h2>Unirse a otra empresa</h2>
                  <WorkspaceSetup
                    inline
                    onCreated={async () => {
                      const r = await supabase!
                        .from("workspaces")
                        .select("id,name");
                      setWorkspaces(r.data || []);
                      setWorkspace(r.data?.[r.data.length - 1] || null);
                    }}
                  />
                </div>
              )}
            </>
          )}
          {view === "method" && <Method />}
          <footer className="footer">
            <span>Experimental OS · V1</span>
            <button onClick={() => void exportData()}>
              Exportar registros JSON
            </button>
          </footer>
        </main>
      </div>
      <dialog
        ref={detail}
        className="detail-dialog"
        onCancel={() => setSelected(null)}
        onClick={(e) => {
          if (e.target === detail.current) setSelected(null);
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
                {selected.kind === "experiment" ? "Champion" : "Responsable"}:{" "}
                {selected.owner_id ? author(selected.owner_id) : "Sin asignar"}
              </span>
              {selected.kind !== "experiment" && selected.fields.status && (
                <Badge state={selected.fields.status} />
              )}
            </div>
            {editable && (demo || schemaReady) && (
              <Action
                className="primary"
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
                onClick={() => {
                  create("learning", selected.id);
                  setSelected(null);
                }}
              >
                Documentar aprendizaje
              </Action>
            )}
            <dl className="field-details">
              {schemas[selected.kind]
                .filter(
                  (f) =>
                    selected.fields[f.key] !== undefined &&
                    selected.fields[f.key] !== "",
                )
                .map((f) => (
                  <div key={f.key}>
                    <dt>{f.label}</dt>
                    <dd>
                      {typeof selected.fields[f.key] === "boolean"
                        ? selected.fields[f.key]
                          ? "Sí"
                          : "No"
                        : String(selected.fields[f.key])}
                    </dd>
                  </div>
                ))}
            </dl>
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
        onCancel={() => {
          if (!saving) setDraft(null);
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
                disabled={saving}
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
                  {draft.kind === "experiment" ? "Champion" : "Responsable"}
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
              {schemas[draft.kind].map((f) => (
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
              ))}
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
                disabled={saving}
                onClick={() => setDraft(null)}
              >
                Cancelar
              </button>
              <button type="submit" className="btn primary" disabled={saving}>
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
  onDemo,
  onMessage,
  onAuthenticated,
}: {
  onDemo: () => void;
  onMessage: (s: string) => void;
  onAuthenticated: (user: User) => void;
}) {
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<
    "login" | "signup" | "reset" | "new-password"
  >("login");
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
        <span className="brand-symbol">
          <Star />
        </span>
        <h1>
          Cada idea merece
          <br />
          un experimento.
        </h1>
        <p>
          Una empresa alineada. Un árbol de oportunidades.
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
        <span className="eyebrow">EXPERIMENTAL OS</span>
        <h2>
          {mode === "signup"
            ? "Crea tu cuenta"
            : mode === "reset"
              ? "Recupera tu acceso"
              : mode === "new-password"
                ? "Nueva contraseña"
                : "Entra en tu empresa"}
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
                else
                  setError(
                    "No se ha podido iniciar sesión tras el registro. Contacta con el administrador para completar el acceso.",
                  );
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
                ? "Crear cuenta"
                : mode === "reset"
                  ? "Enviar enlace"
                  : mode === "new-password"
                    ? "Actualizar contraseña"
                    : "Entrar"}
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
function WorkspaceSetup({
  onCreated,
  inline = false,
}: {
  onCreated: () => void;
  inline?: boolean;
}) {
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("invite") || "");
  }, []);
  const form = (
    <div className="setup-form">
      {!inline && (
        <>
          <span className="brand-symbol">
            <Star />
          </span>
          <h1>Tu empresa experimental</h1>
          <p>Crea un espacio privado o únete mediante una invitación.</p>
        </>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const r = await supabase!.rpc("create_workspace", {
            workspace_name: name,
          });
          if (r.error) setError(r.error.message);
          else onCreated();
          setBusy(false);
        }}
      >
        <label>
          Nombre de la empresa
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mi empresa"
          />
        </label>
        <button className="btn primary" disabled={busy}>
          Crear empresa
        </button>
      </form>
      <hr />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          let t = token;
          try {
            if (token.includes("://"))
              t = new URL(token).searchParams.get("invite") || "";
          } catch {}
          const r = await supabase!.rpc("join_workspace", { invite_token: t });
          if (r.error) setError(r.error.message);
          else {
            window.history.replaceState({}, "", window.location.pathname);
            onCreated();
          }
          setBusy(false);
        }}
      >
        <label>
          Enlace o código de invitación
          <input
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </label>
        <button className="btn" disabled={busy}>
          Unirme a la empresa
        </button>
      </form>
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
    </div>
  );
  return inline ? (
    form
  ) : (
    <div className="auth-shell">
      <div className="auth-card">{form}</div>
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
          selecciónalo en Experimentos, Aprendizajes o Growth Tree. Cada
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
          Asigna un champion, documenta el reparto de tráfico, los riesgos y la
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
        <h2>Growth Tree: conectar las ideas con el crecimiento</h2>
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
