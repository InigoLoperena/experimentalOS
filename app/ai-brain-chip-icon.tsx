import {Brain, Cpu} from 'lucide-react';

/** Complete brain silhouette with a clearly visible microchip in its center. */
export function AIBrainChipIcon({size=20,className=''}:{size?:number;className?:string}) {
 const chipSize=Math.max(8,Math.round(size*.4));
 return <span aria-hidden="true" className={'ai-brain-chip-icon '+className} style={{width:size,height:size}}>
  <Brain size={size} strokeWidth={2.1}/>
  <Cpu className="ai-brain-chip-core" size={chipSize} strokeWidth={2.4}/>
 </span>;
}
