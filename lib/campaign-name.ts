import {ApiError} from './server-access';
// Internal experiment codes remain in database relationships, not public campaign names.
export function experimentCampaignName(title:string){
 const name=`Experimento · ${title}`;
 if(!title.trim()||/[\r\n\x00]/.test(title)||name.length>200)throw new ApiError(`El nombre de la campaña debe ser «Experimento · título». Acorta el título del experimento a ${200-'Experimento · '.length} caracteres y usa una sola línea.`,400);
 return name;
}
