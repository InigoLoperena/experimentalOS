import {Brain} from 'lucide-react';

/** Whole-brain outline; no chip or overlays. */
export function AIBrainIcon({size=20,className=''}:{size?:number;className?:string}) {
 return <Brain size={size} strokeWidth={2.3} className={'ai-brain-icon '+className} aria-hidden="true"/>;
}
