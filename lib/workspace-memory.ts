import type {SupabaseClient} from '@supabase/supabase-js';
import {ApiError} from './server-access';
import {recordMemory,selectMemory,type MemorySource} from './ai-memory';
import type {Item} from './model';
export async function workspaceMemory(client:SupabaseClient,workspace:string,question:string){
 const [catalog,search,facts]=await Promise.all([
  client.from('records').select('id,workspace_id,project_id,kind,title,fields,parent_id,related_id,updated_at').eq('workspace_id',workspace).eq('kind','project').order('id'),
  client.rpc('search_workspace_memory',{w:workspace,q:question,p:null}),
  client.rpc('workspace_metric_facts',{w:workspace}),
 ]);
 if(catalog.error||search.error||facts.error)throw new ApiError('No se pudo recuperar la memoria compartida del equipo.',503);
 const projects=(catalog.data||[]) as Item[],names=new Map(projects.map(p=>[p.id,p.title]));
 const sources=(search.data?.sources||[]).map((s:MemorySource)=>({...s,project_name:s.project_id?names.get(s.project_id)||'Proyecto del equipo':'Conocimiento del equipo'}));
 const memory=selectMemory(sources,question);
 return {projects,sources:memory.selected,projectCatalog:projects.map(recordMemory),facts:facts.data||[],coverage:{available:Number(search.data?.coverage?.available||0),included:memory.selected.length,scope:'workspace' as const,meaning:'Fragmentos relevantes de la memoria del equipo; la selección no equivale a revisar todas las fuentes.'}};
}
