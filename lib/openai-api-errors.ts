import {ApiError} from "./server-access";

/**
 * Translate OpenAI failures without exposing provider messages, prompts,
 * account identifiers or API credentials.
 */
type ProviderError={error?:{code?:unknown;type?:unknown}};
const safeCode=(value:unknown):string|null=>
 typeof value==="string"&&/^[a-z0-9_]{1,80}$/i.test(value)?value:null;

export async function openAIResponseError(response:Response,operation:"chat"|"prepare"|"transcribe"|"verify"):Promise<ApiError>{
 let parsed:ProviderError|null=null;
 try{parsed=await response.json() as ProviderError;}catch{/* Upstream may return non-JSON gateway errors. */}
 const code=safeCode(parsed?.error?.code),type=safeCode(parsed?.error?.type),tag=code||type;
 const requestId=response.headers.get("x-request-id");
 // Only bounded diagnostic metadata, never the upstream response body.
 console.warn("OpenAI API request failed",{
  operation,status:response.status,code,type,
  requestId:requestId&&/^[a-zA-Z0-9_-]{1,100}$/.test(requestId)?requestId:null
 });
 if(response.status===401||tag==="invalid_api_key")
  return new ApiError("La clave de OpenAI no es válida o ha sido revocada. Revisa la integración de OpenAI en Xperiments.",503);
 if(response.status===403)
  return new ApiError("La clave de OpenAI no tiene permisos para acceder a este recurso o modelo. Revisa los permisos del proyecto en OpenAI Platform.",503);
 if(tag==="project_spend_limit_exceeded")
  return new ApiError("El proyecto de OpenAI alcanzó su límite máximo de gasto. Revisa Project → Limits en OpenAI Platform.",503);
 if(tag==="organization_spend_limit_exceeded")
  return new ApiError("La organización de OpenAI alcanzó su límite máximo de gasto. Revisa los límites de la organización en OpenAI Platform.",503);
 if(tag==="organization_usage_limit_exceeded")
  return new ApiError("La organización alcanzó su límite de uso aprobado en OpenAI. Revisa Organization → Limits.",503);
 if(tag==="credit_balance_exhausted")
  return new ApiError("Se agotaron los créditos prepagados de OpenAI. Revisa Billing en OpenAI Platform.",503);
 if(tag==="insufficient_quota")
  return new ApiError("OpenAI indica que no hay cuota disponible. Revisa el saldo, los límites de gasto y la facturación del proyecto y la organización.",503);
 if(response.status===429)
  return new ApiError("OpenAI está limitando temporalmente el ritmo de solicitudes o tokens. Reintenta más tarde; si persiste, revisa los límites de velocidad del modelo.",429);
 if(tag==="model_not_found"||tag==="model_not_available")
  return new ApiError("El modelo configurado no está disponible para tu proyecto de OpenAI. Revisa los modelos permitidos en OpenAI Platform.",503);
 if(response.status>=500)
  return new ApiError("OpenAI tiene un fallo temporal del servicio. No se han modificado tus fichas. Inténtalo de nuevo más tarde.",502);
 if(response.status===400||response.status===404||response.status===422)
  return new ApiError("OpenAI rechazó la solicitud o el modelo configurado. Revisa la configuración de la integración.",502);
 return new ApiError("La llamada a OpenAI no se ha completado. Revisa la conexión de OpenAI y vuelve a intentarlo.",502);
}
