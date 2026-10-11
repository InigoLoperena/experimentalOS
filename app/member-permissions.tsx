'use client';
import {useState} from 'react';
import type {Member} from '@/lib/model';
import {permissionGroups,permissionActions} from '@/lib/permissions';
import {supabase} from '@/lib/supabase';
export function MemberPermissions({member,workspaceId,editable,onSaved}:{member:Member;workspaceId:string;editable:boolean;onSaved:()=>Promise<void>}){
 const [permissions,setPermissions]=useState(member.permissions||[]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(member.role==='owner')return null;
 return <details className="member-permissions"><summary>Permisos de {member.name}</summary>
  <p className="small">Crear y editar son permisos independientes. El rol Lector siempre permite solo consultar. Las APIs, invitaciones y permisos del equipo corresponden al superadministrador.</p>
  <div className="table-scroll"><table><thead><tr><th>Área</th>{Object.values(permissionActions).map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>
   {Object.entries(permissionGroups).map(([group,label])=><tr key={group}><th scope="row">{label}</th>{Object.entries(permissionActions).map(([action,actionLabel])=>{const key=`${group}.${action}`;return <td key={action}><input type="checkbox" aria-label={`${actionLabel} ${label} · ${member.name}`} disabled={!editable||busy||member.role!=='editor'} checked={member.role==='editor'&&permissions.includes(key)} onChange={e=>setPermissions(previous=>e.target.checked?[...previous,key]:previous.filter(value=>value!==key))}/></td>;})}</tr>)}
  </tbody></table></div>
  {editable&&member.role==='editor'&&<button type="button" className="btn" disabled={busy} onClick={async()=>{if(busy)return;setBusy(true);setError('');try{const result=await supabase!.rpc('set_member_permissions',{w:workspaceId,member_id:member.user_id,granted:permissions});if(result.error)throw new Error(result.error.message);await onSaved();}catch(err){setError(err instanceof Error?err.message:'No se pudieron guardar los permisos.');}finally{setBusy(false);}}}>{busy?'Guardando…':'Guardar permisos'}</button>}
  {error&&<p className="error" role="alert">{error}</p>}
 </details>;
}
