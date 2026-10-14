import sharp from 'sharp';
import {metaFormats} from './meta-options';
import {digest,type MetaStep} from './meta-build';
import {ApiError} from './server-access';
export {privateAttachmentBytes as privateMetaFile} from './attachment-bytes';
export async function renderMetaImage(bytes:Buffer,step:MetaStep){
 if(!step.placement||!step.crop)throw new ApiError('Falta el formato de imagen.',400);
 const size=metaFormats[step.placement];
 const image=sharp(bytes,{limitInputPixels:40000000,animated:false});
 const info=await image.metadata();
 if(!['jpeg','png','webp'].includes(info.format||'')||!info.width||!info.height||(info.pages||1)>1)throw new ApiError('Utiliza una imagen estática JPG, PNG o WebP; los GIF no se convierten a anuncios estáticos.',400);
 const output=await image.rotate().resize(size.width,size.height,{fit:'cover',position:step.crop}).jpeg({quality:88}).toBuffer();
 const thumbnail=await sharp(output).resize({width:280}).jpeg({quality:75}).toBuffer();
 return {bytes:output,hash:digest(output.toString('base64')),preview:`data:image/jpeg;base64,${thumbnail.toString('base64')}`,width:size.width,height:size.height,upscaled:info.width<size.width||info.height<size.height};
}
