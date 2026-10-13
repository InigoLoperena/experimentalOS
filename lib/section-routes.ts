/** Canonical paths for each Xperiments section. */
export const sectionPaths = {
 projects: '/proyectos', experiments: '/experimentos', learning: '/aprendizajes',
 ai: '/ia', map: '/goi-tree', goals: '/goi-tree/objetivos',
 input_metrics: '/goi-tree/input-metrics', opportunities: '/goi-tree/oportunidades',
 ideas: '/goi-tree/ideas', team: '/equipo',
 integrations: '/integraciones', method: '/como-utilizar',
} as const;
export type SectionView = keyof typeof sectionPaths;

export function viewForPath(pathname:string):SectionView|null {
 const pathnameNormalized=pathname.replace(/\/+$/,'')||'/';
 if(pathnameNormalized==='/')return 'projects';
 const entry=(Object.entries(sectionPaths) as [SectionView,string][]).find(([,value])=>value===pathnameNormalized);
 return entry?.[0]??null;
}
export function pathForView(view:SectionView):string {return sectionPaths[view];}
