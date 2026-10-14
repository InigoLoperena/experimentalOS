import sharp from 'sharp';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Item} from './model';
import type {Attachment} from './attachments';
import {privateAttachmentBytes} from './attachment-bytes';
import {digest} from './meta-build';
import {ApiError} from './server-access';
import type {GoogleRecipe,GoogleImage} from './google-ads-build';

export async function googleDisplayImages(client:SupabaseClient,experiment:Item,recipe:GoogleRecipe,attachments:Attachment[]):Promise<GoogleImage[]>{
 if(recipe.type!=='DISPLAY')return [];
 const files=attachments.filter(a=>a.record_id===experiment.id&&a.workspace_id===experiment.workspace_id&&a.kind==='image').sort((a,b)=>a.name.localeCompare(b.name));
 const result:GoogleImage[]=[];
 for(const [i,variant] of recipe.variants.entries()){
  const named=variant.media_names||[];
  const selected=named.length?files.filter(a=>named.includes(a.name)):files.length===1?[files[0]]:files.length===2?[files[i]]:[];
  if(selected.length!==1||named.length>1)throw new ApiError(`Asigna una imagen exacta a ${variant.label} mediante el prompt. Para este test se prepara una imagen por variante, adaptada a dos formatos.`,400);
  const attachment=selected[0],bytes=await privateAttachmentBytes(client,attachment);
  const metadata=await sharp(bytes,{limitInputPixels:40000000,animated:false}).metadata();
  if(!['png','jpeg','webp'].includes(metadata.format||'')||!metadata.width||!metadata.height||(metadata.pages||1)>1)throw new ApiError('Display necesita imágenes estáticas JPG, PNG o WebP.',400);
  for(const format of ['landscape','square'] as const){
   const width=1200,height=format==='landscape'?628:1200;
   const cropped=await sharp(bytes,{limitInputPixels:40000000}).rotate().resize(width,height,{fit:'cover',position:'centre'}).jpeg({quality:88}).toBuffer();
   if(cropped.length>5120000)throw new ApiError('La imagen adaptada supera el límite de Google Ads.',400);
   const thumbnail=await sharp(cropped).resize({width:280}).jpeg({quality:75}).toBuffer();
   result.push({variant:variant.id,format,name:attachment.name,attachment_id:attachment.id,hash:digest(cropped.toString('base64')),bytes:cropped.toString('base64'),width,height,preview:`data:image/jpeg;base64,${thumbnail.toString('base64')}`,upscaled:metadata.width<width||metadata.height<height});
  }
 }
 return result;
}
