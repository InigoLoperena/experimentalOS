import type {Kind,Member} from './model';
export const permissionGroups={projects:'Proyectos',experiments:'Experimentos',learnings:'Aprendizajes',growth:'GOI Tree'} as const;
export const permissionActions={create:'Crear',edit:'Editar',delete:'Eliminar'} as const;
export type RecordAction=keyof typeof permissionActions;
export const permissionKeys=Object.keys(permissionGroups).flatMap(group=>Object.keys(permissionActions).map(action=>`${group}.${action}`));
export function recordGroup(kind:Kind){return kind==='project'?'projects':kind==='experiment'?'experiments':kind==='learning'?'learnings':'growth';}
export function canRecord(member:Pick<Member,'role'|'permissions'>|undefined,kind:Kind,action:RecordAction){
  if(member?.role==='owner')return true;
  return member?.role==='editor'&&(member.permissions||[]).includes(`${recordGroup(kind)}.${action}`);
}
export function canConfigure(member:Pick<Member,'role'>|undefined){return member?.role==='owner';}
