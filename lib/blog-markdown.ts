// Keep HTML inert. Only this small, semantic Markdown subset is rendered.
export function safeBlogHref(value:string):string|null{
 const href=value.trim();
 if(!href||/[\u0000-\u0020\u007f\\]/.test(href))return null;
 if(href.startsWith('/')&&!href.startsWith('//'))return href;
 if(href.startsWith('#'))return href;
 try{const url=new URL(href);return ['https:','http:','mailto:'].includes(url.protocol)?href:null;}catch{return null;}
}
export type BlogBlock={type:'paragraph'|'quote'|'heading'|'list'|'code';text?:string;level?:number;ordered?:boolean;items?:string[]};
export function blogMarkdownBlocks(markdown:string):BlogBlock[]{
 const lines=markdown.replace(/\r\n?/g,'\n').split('\n'),blocks:BlogBlock[]=[];
 let index=0;
 while(index<lines.length){
  const line=lines[index];
  if(!line.trim()){index++;continue;}
  if(/^\s*```/.test(line)){const code:string[]=[];index++;while(index<lines.length&&!/^\s*```/.test(lines[index]))code.push(lines[index++]);if(index<lines.length)index++;blocks.push({type:'code',text:code.join('\n')});continue;}
  const heading=/^(#{1,4})\s+(.+)$/.exec(line);if(heading){blocks.push({type:'heading',level:Math.max(2,heading[1].length),text:heading[2]});index++;continue;}
  if(/^>\s?/.test(line)){const quote:string[]=[];while(index<lines.length&&/^>\s?/.test(lines[index]))quote.push(lines[index++].replace(/^>\s?/,''));blocks.push({type:'quote',text:quote.join(' ')});continue;}
  const list=/^\s*(?:([-*])|(\d+)\.)\s+(.+)$/.exec(line);
  if(list){const ordered=!!list[2],items:string[]=[];while(index<lines.length){const item=/^\s*(?:([-*])|(\d+)\.)\s+(.+)$/.exec(lines[index]);if(!item||!!item[2]!==ordered)break;items.push(item[3]);index++;}blocks.push({type:'list',ordered,items});continue;}
  const paragraph=[line];index++;
  while(index<lines.length&&lines[index].trim()&&!/^(#{1,4}\s|>|\s*```|\s*(?:[-*]|\d+\.)\s)/.test(lines[index]))paragraph.push(lines[index++]);
  blocks.push({type:'paragraph',text:paragraph.join(' ')});
 }
 return blocks;
}
