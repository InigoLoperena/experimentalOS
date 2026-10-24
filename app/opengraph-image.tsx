import { ImageResponse } from 'next/og';
export const alt='Xperiments — Diseña experimentos con IA. Aprende con cada prueba.';
export const size={width:1200,height:630};
export const contentType='image/png';
export default function OpenGraphImage() {
 return new ImageResponse(<div style={{display:'flex',flexDirection:'column',width:'100%',height:'100%',background:'#101b36',padding:'64px 72px',color:'#edf2ff',fontFamily:'sans-serif'}}><div style={{display:'flex',alignItems:'center',fontSize:44,fontWeight:800,letterSpacing:-2}}><span style={{color:'#8abcff'}}>X</span><span style={{color:'#b7ff4c'}}>periments</span></div><div style={{display:'flex',marginTop:50,color:'#a4b4d1',fontSize:20,letterSpacing:4}}>EXPERIMENTAL INNOVATION OS</div><div style={{display:'flex',marginTop:22,fontSize:64,fontWeight:800,lineHeight:1.12}}>Diseña experimentos con IA.</div><div style={{display:'flex',fontSize:64,fontWeight:800,color:'#b7ff4c',lineHeight:1.12}}>Aprende con cada prueba.</div><div style={{display:'flex',marginTop:'auto',fontSize:24,color:'#a4b4d1'}}>Hipótesis → Experimentos → Resultados → Aprendizajes</div></div>,size);
}
