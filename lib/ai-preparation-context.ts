import type {Item} from './model';
import {preparationKeys} from './ai-preparation';
import {knowledgeMemory,selectMemory,type Knowledge,type MemorySource} from './ai-memory';
export type PreparationRecord=Pick<Item,'id'|'kind'|'title'|'fields'|'updated_at'>;
const projectKeys=['description','context','north_star','north_star_description','site_url','url','website','target','metric','definition'];
const historyKeys=['description','definition','context','hypothesis','metric','success_criteria','result','evidence','learning','decision','next_steps','tags','channel','validation'];
const fields=(record:PreparationRecord,keys:string[],excerpt=false)=>Object.fromEntries(keys.filter(key=>record.fields?.[key]!==undefined).map(key=>[key,excerpt?String(record.fields[key]).slice(0,1000):record.fields[key]]));
export function preparationContext(project:PreparationRecord,records:PreparationRecord[],imported:Knowledge[],current:Record<string,unknown>,prompt:string){
 // Preserve the actual project and current form. Only optional historical evidence
 // is excerpted and selected; provider payloads/secrets never enter this catalog.
 const northStars=records.filter(record=>record.kind==='north_star').map(record=>({id:record.id,title:record.title,fields:fields(record,['definition','metric','north_star','target','unit'])}));
 const sources:MemorySource[]=[...records.filter(record=>record.kind!=='north_star').map(record=>({id:record.id,kind:record.kind,title:record.title,date:record.updated_at,excerpt:JSON.stringify(fields(record,historyKeys,true))})),...imported.flatMap(knowledgeMemory)];
 // Ranking a very long request must not multiply its full size by the catalog.
 // This retrieval query is separate from the full, unchanged user request.
 const relevanceQuery=prompt.length>32000?prompt.slice(0,16000)+'\n'+prompt.slice(-16000):prompt;
 const ranked=selectMemory(sources,relevanceQuery,24000).selected;
 const selected:MemorySource[]=[];let bytes=2;
 for(const source of ranked){const size=Buffer.byteLength(JSON.stringify(source))+1;if(bytes+size>24000)continue;selected.push(source);bytes+=size;}
 const coverage={available:sources.length+northStars.length,included:selected.length+northStars.length,meaning:'Selección de contexto histórico relevante; no implica haber revisado todos los registros ni validar aprendizajes.'};
 return {project:{id:project.id,title:project.title,fields:fields(project,projectKeys)},north_stars:northStars,knowledge:selected,coverage,
  current:Object.fromEntries(preparationKeys.map(key=>[key,typeof current[key]==='string'?current[key]:null])),
  context_ids:[...new Set([project.id,...northStars.map(row=>row.id),...selected.map(row=>row.id)])]};
}
