"use client";

import { useState } from "react";
import {
  ChevronRight, FlaskConical, Lightbulb, Microscope, Plus, Search,
  Target, Pencil, Trash2, ExternalLink,
} from "lucide-react";
import type { Item, Kind } from "@/lib/model";

export const mvpProjectFields = [
  { key: "site_url", label: "Web" },
  { key: "targets", label: "Targets" },
  { key: "value_propositions", label: "Propuestas de valor" },
  { key: "monetization_channels", label: "Vías de monetización" },
  { key: "north_star", label: "North Star Metric" },
] as const;

export function mvpTargets(record: Item): string[] {
  return String(record.fields.mvp_links || "")
    .split(",").map(value => value.trim()).filter(Boolean);
}
export function linkedHypothesis(experiment: Item): string {
  return String(experiment.fields.mvp_hypothesis_id || "");
}

type Props = {
  project: Item;
  items: Item[];
  readOnly: boolean;
  canCreate: (kind: Kind) => boolean;
  canEdit: (kind: Kind) => boolean;
  canDelete: (kind: Kind) => boolean;
  onCreate: (kind: Kind, parent: string | null) => void;
  onOpen: (item: Item) => void;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
  onEditProject: () => void;
};

export function MvpExperimentation({
  project, items, readOnly, canCreate, canEdit, canDelete, onCreate, onOpen, onEdit, onDelete, onEditProject,
}: Props) {
  const [expandedAll, setExpandedAll] = useState(false);
  const [revision, setRevision] = useState(0);
  const problems = items.filter(item => item.kind === "opportunity");
  const hypotheses = items.filter(item => item.kind === "hypothesis");
  const experiments = items.filter(item => item.kind === "experiment");
  const research = items.filter(item => item.kind === "research");
  const problemIds = new Set(problems.map(item => item.id));
  const hypothesisIds = new Set(hypotheses.map(item => item.id));
  const linkedExperimentIds = new Set(
    experiments.filter(item => hypothesisIds.has(linkedHypothesis(item))).map(item => item.id),
  );
  const orphanHypotheses = hypotheses.filter(item => !item.parent_id || !problemIds.has(item.parent_id));
  const orphanExperiments = experiments.filter(item => !linkedExperimentIds.has(item.id));
  const names = new Map(items.map(item => [item.id, item.title]));

  const createButton = (label: string, kind: Kind, parent: string | null = null) =>
    !readOnly && canCreate(kind) && (
      <button className="btn mvp-add" onClick={() => onCreate(kind, parent)} type="button">
        <Plus size={15} aria-hidden="true" /> {label}
      </button>
    );
  const actions = (item: Item) => !readOnly && (
    <span className="mvp-card-actions">
      {canEdit(item.kind) && <button type="button" title="Editar" aria-label={"Editar " + item.title} onClick={() => onEdit(item)}><Pencil size={14}/></button>}
      {canDelete(item.kind) && <button type="button" title="Eliminar" aria-label={"Eliminar " + item.title} onClick={() => onDelete(item)}><Trash2 size={14}/></button>}
    </span>
  );
  const card = (item: Item, role: "problem"|"hypothesis"|"research"|"experiment") => (
    <article className={"mvp-card mvp-card-" + role} key={item.id}>
      <div className="mvp-card-heading">
        <button type="button" className="mvp-card-title" onClick={() => onOpen(item)}>{item.title}</button>
        {actions(item)}
      </div>
      {role === "problem" && <>
        {item.fields.description && <p>{String(item.fields.description)}</p>}
        {item.fields.evidence && <small><strong>Evidencias: </strong>{String(item.fields.evidence)}</small>}
        {item.fields.source && <small><strong>Fuentes: </strong>{String(item.fields.source)}</small>}
      </>}
      {role === "hypothesis" && <>
        {item.fields.belief && <p><strong>¿Qué creemos?</strong> {String(item.fields.belief)}</p>}
        {item.fields.reason && <small><strong>¿Por qué? </strong>{String(item.fields.reason)}</small>}
        {item.fields.validation_need && <small><strong>Comprobar: </strong>{String(item.fields.validation_need)}</small>}
      </>}
      {role === "research" && <>
        {item.fields.description && <p>{String(item.fields.description)}</p>}
        <small>{String(item.fields.method || "Método por definir")}{item.fields.audience ? " · " + String(item.fields.audience) : ""}</small>
        {mvpTargets(item).length > 0 && <small><strong>Vinculada a: </strong>{mvpTargets(item).map(id => names.get(id) || "Ficha eliminada").join(" · ")}</small>}
      </>}
      {role === "experiment" && <>
        {item.fields.description && <p>{String(item.fields.description)}</p>}
        {item.fields.context && !item.fields.description && <p>{String(item.fields.context)}</p>}
        {item.fields.metric && <small><strong>Medición: </strong>{String(item.fields.metric)}</small>}
        {item.parent_id && names.has(item.parent_id) && <small><strong>Idea en GOI Tree: </strong>{names.get(item.parent_id)}</small>}
      </>}
      <button className="mvp-open" type="button" onClick={() => onOpen(item)}>Abrir ficha <ExternalLink size={13}/></button>
    </article>
  );
  const experimentNodes = (hypothesisId: string) => {
    const branch = experiments.filter(item => linkedHypothesis(item) === hypothesisId);
    return <div className="mvp-nested mvp-experiment-list">
      {branch.map(item => card(item, "experiment"))}
      {createButton("+ Añadir experimento", "experiment", hypothesisId)}
    </div>;
  };
  const hypothesisNodes = (problem: Item) => {
    const children = hypotheses.filter(item => item.parent_id === problem.id);
    return <div className="mvp-nested mvp-hypothesis-list">
      {children.map(item => (
        <details key={item.id} className="mvp-tree-branch" open={expandedAll} data-revision={revision}>
          <summary><Lightbulb size={16}/><span>{item.title}</span><ChevronRight size={14}/></summary>
          <div className="mvp-branch-content">
            {card(item,"hypothesis")}
            {experimentNodes(item.id)}
          </div>
        </details>
      ))}
      {createButton("+ Añadir hipótesis", "hypothesis", problem.id)}
    </div>;
  };

  const lines = (value: unknown) => String(value || "").split(/\r?\n/).map(v => v.trim()).filter(Boolean);
  return <div className="mvp-workspace">
    <section className="mvp-project-summary">
      <div className="mvp-project-top">
        <div>
          <span className="eyebrow">Proyecto · Experimentación de MVPs</span>
          <h2>{project.title}</h2>
          <p>{String(project.fields.description || "")}</p>
        </div>
        {!readOnly && canEdit("project") && <button className="btn" type="button" onClick={onEditProject}><Pencil size={15}/> Editar proyecto</button>}
      </div>
      <div className="mvp-project-fields">
        {mvpProjectFields.map(field => <div key={field.key}><strong>{field.label}</strong>
          {field.key === "site_url" && project.fields.site_url
            ? <a href={String(project.fields.site_url)} rel="noopener noreferrer" target="_blank">{String(project.fields.site_url)}</a>
            : lines(project.fields[field.key]).length
              ? <ul>{lines(project.fields[field.key]).map((line,index)=><li key={index}>{line}</li>)}</ul>
              : <span>Sin definir</span>}
        </div>)}
      </div>
    </section>
    <div className="mvp-flow-labels">
      <div><Microscope size={22}/><strong>Investigación</strong><small>Descubrir y comprender</small></div>
      <div><Search size={22}/><strong>Problemas u Oportunidades</strong><small>Retos y necesidades</small></div>
      <div><Lightbulb size={22}/><strong>Hipótesis</strong><small>Posibles explicaciones</small></div>
      <div><FlaskConical size={22}/><strong>Experimentos</strong><small>Comprobar con datos reales</small></div>
    </div>
    <div className="mvp-main">
      <section className="mvp-research-column">
        <header><h3><Microscope size={18}/> Investigación <span>({research.length})</span></h3>
          {createButton("+ Añadir investigación", "research")}
        </header>
        {research.map(item => card(item,"research"))}
        {!research.length && <p className="small">Añade entrevistas, encuestas o análisis de mercado y vincúlalos a problemas o hipótesis.</p>}
      </section>
      <section className="mvp-tree-column">
        <header className="mvp-tree-header">
          <h3><Search size={18}/> Problemas u Oportunidades <span>({problems.length})</span></h3>
          <div className="mvp-tree-tools">
            <button className="btn" type="button" onClick={() => {setExpandedAll(value=>!value);setRevision(n=>n+1);}}>
              {expandedAll?"Contraer todo":"Expandir todo"}
            </button>
            {createButton("+ Añadir problema u oportunidad", "opportunity")}
          </div>
        </header>
        {problems.map(problem => (
          <details className="mvp-tree-branch mvp-problem-branch" key={problem.id + ":" + revision} open={expandedAll}>
            <summary><Search size={18}/><span>{problem.title}</span><ChevronRight size={16}/></summary>
            <div className="mvp-branch-content">
              {card(problem, "problem")}
              {hypothesisNodes(problem)}
            </div>
          </details>
        ))}
        {!problems.length && <p className="small">Todavía no hay problemas u oportunidades registrados.</p>}
        {orphanHypotheses.length > 0 && <section className="mvp-orphans">
          <h3>Hipótesis sin problema ({orphanHypotheses.length})</h3>
          {orphanHypotheses.map(hypothesis => <div key={hypothesis.id} className="mvp-orphan-card">
            {card(hypothesis, "hypothesis")}
            {experimentNodes(hypothesis.id)}
          </div>)}
        </section>}
        {orphanExperiments.length > 0 && <section className="mvp-orphans">
          <h3>Experimentos sin hipótesis ({orphanExperiments.length})</h3>
          <p className="small">Estos son los mismos experimentos de GOI Tree. Abre cada ficha para asignarle una hipótesis, sin modificar su idea.</p>
          {orphanExperiments.map(item=>card(item,"experiment"))}
        </section>}
      </section>
    </div>
  </div>;
}
