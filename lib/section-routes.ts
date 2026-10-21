/** Canonical paths for each Xperiments section. */
export const sectionPaths = {
 projects: '/proyectos', mvp: '/experimentacion-mvps',
 mvp_problems: '/experimentacion-mvps/problemas-oportunidades',
 mvp_hypotheses: '/experimentacion-mvps/hipotesis',
 mvp_experiments: '/experimentacion-mvps/experimentos',
 mvp_research: '/experimentacion-mvps/investigacion',
 experiments: '/goi-tree/experimentos', learning: '/aprendizajes',
 ai: '/ia', map: '/goi-tree', goals: '/goi-tree/objetivos',
 input_metrics: '/goi-tree/input-metrics', opportunities: '/goi-tree/oportunidades',
 ideas: '/goi-tree/ideas', team: '/equipo',
 integrations: '/integraciones', method: '/como-utilizar',
} as const;
export type SectionView = keyof typeof sectionPaths;

export function viewForPath(pathname:string):SectionView|null {
 const pathnameNormalized=pathname.replace(/\/+$/,'')||'/';
 if(pathnameNormalized==='/')return 'projects';
 // Preserve existing links, bookmarks and integrations from the former main menu.
 if(pathnameNormalized==='/experimentos')return 'experiments';
 const entry=(Object.entries(sectionPaths) as [SectionView,string][]).find(([,value])=>value===pathnameNormalized);
 return entry?.[0]??null;
}
export function pathForView(view:SectionView):string {return sectionPaths[view];}
