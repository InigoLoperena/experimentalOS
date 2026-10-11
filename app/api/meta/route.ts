import { NextResponse } from 'next/server';
import { authenticatedClient, authorizedProject, ApiError } from '@/lib/server-access';
import { metaAccount, metaCampaigns, metaReport } from '@/lib/meta-ads';
import {resolvedMetaConnection} from '@/lib/integration-service';

export const runtime = 'nodejs';
export const maxDuration = 60;
const headers = {'Cache-Control':'private, no-store'};

export async function POST(request: Request) {
  try {
    const {client} = await authenticatedClient(request);
    const raw = await request.text();
    if (Buffer.byteLength(raw)>5000) throw new ApiError('La solicitud es demasiado larga.',400);
    let body;
    try {body=JSON.parse(raw);} catch {throw new ApiError('La solicitud no es válida.',400);}
    if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.project_id !== 'string') throw new ApiError('Selecciona un proyecto válido.',400);
    const project = await authorizedProject(client,body.project_id);
    if (body.action === 'connection') {
      try { await resolvedMetaConnection(client,project); }
      catch (error) {
        if (error instanceof ApiError && error.status===403) return NextResponse.json({available:false},{headers});
        throw error;
      }
      return NextResponse.json({available:true},{headers});
    }
    const connection = await resolvedMetaConnection(client,project);
    if (body.action === 'preview') {
      const report = await metaReport(connection,body.external_id,'campaign',body.start,body.end);
      return NextResponse.json({resource_id:null,...report},{headers});
    }
    if (!body.resource_id) {
      if (body.after != null && typeof body.after !== 'string') throw new ApiError('La solicitud no es válida.',400);
      const account = await metaAccount(connection);
      const campaigns = await metaCampaigns(connection,body.after || '');
      return NextResponse.json({account,...campaigns},{headers});
    }
    if (typeof body.resource_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.resource_id)) throw new ApiError('Selecciona un recurso vinculado.',400);
    const {data:resource,error} = await client.from('external_resources').select('*').eq('id',body.resource_id)
      .eq('project_id',project.id).eq('workspace_id',project.workspace_id).eq('provider','meta_ads').single();
    if (error || !resource) throw new ApiError('No tienes acceso a ese recurso de Meta.',403);
    const report = await metaReport(connection,resource.external_id,resource.resource_type,body.start,body.end);
    return NextResponse.json({resource_id:resource.id,...report},{headers});
  } catch (error) {
    return NextResponse.json({error:error instanceof ApiError ? error.message : 'No se pudo consultar Meta. No se guardaron cambios.'},{status:error instanceof ApiError ? error.status : 502,headers});
  }
}
