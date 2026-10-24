import {Fragment,type ReactNode} from 'react';
import {blogMarkdownBlocks,safeBlogHref} from '@/lib/blog-markdown';
function inline(text:string):ReactNode[]{
 const result:ReactNode[]=[];const tokens=/\[([^\]\n]+)\]\(([^)\n]+)\)|\*\*([^*\n]+)\*\*|`([^`\n]+)`/g;let offset=0,match:RegExpExecArray|null;
 while((match=tokens.exec(text))){result.push(text.slice(offset,match.index));if(match[1]){const href=safeBlogHref(match[2]);result.push(href?<a key={match.index} href={href} rel="noopener noreferrer">{match[1]}</a>:match[1]);}else if(match[3])result.push(<strong key={match.index}>{match[3]}</strong>);else result.push(<code key={match.index}>{match[4]}</code>);offset=tokens.lastIndex;}
 result.push(text.slice(offset));return result;
}
export function BlogContent({markdown}:{markdown:string}){
 return <div className="blog-prose">{blogMarkdownBlocks(markdown).map((block,index)=>{
  const content=inline(block.text||'');
  if(block.type==='heading')return block.level===4?<h4 key={index}>{content}</h4>:block.level===3?<h3 key={index}>{content}</h3>:<h2 key={index}>{content}</h2>;
  if(block.type==='quote')return <blockquote key={index}>{content}</blockquote>;
  if(block.type==='code')return <pre key={index}><code>{block.text}</code></pre>;
  if(block.type==='list'){const items=block.items!.map((item,key)=><li key={key}>{inline(item)}</li>);return block.ordered?<ol key={index}>{items}</ol>:<ul key={index}>{items}</ul>;}
  return <p key={index}>{content.map((part,key)=><Fragment key={key}>{part}</Fragment>)}</p>;
 })}</div>;
}
