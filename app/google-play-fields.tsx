'use client';
import {emptyGooglePlay,playAssets,playMetrics,type GooglePlayOptions} from '@/lib/google-play-options';
export function GooglePlayFields({value,disabled,onChange}:{value:GooglePlayOptions|null|undefined;disabled:boolean;onChange:(value:GooglePlayOptions)=>void}){
 const p=value||emptyGooglePlay();
 return <fieldset disabled={disabled} className="monitoring-block monitoring-grid"><legend>Test de la ficha de Google Play</legend>
 <p className="small full">Preparamos los materiales aquí. La API pública no permite crear este test ni leer resultados por variante: se configura en Play Console y se importan los resultados manualmente.</p>
 <label>Tipo de test<select value={p.type||''} onChange={e=>onChange({...p,type:e.target.value as GooglePlayOptions['type']||null,asset:e.target.value==='graphics'&&['short_description','full_description'].includes(p.asset||'')?null:p.asset})}><option value="">Seleccionar</option><option value="graphics">Gráficos de la ficha predeterminada</option><option value="localized">Ficha localizada · textos o gráficos</option></select></label>
 <label>Idioma de la ficha<input placeholder="es-ES" maxLength={35} value={p.language||''} onChange={e=>onChange({...p,language:e.target.value||null})}/></label>
 <label>Elemento que cambia<select value={p.asset||''} onChange={e=>onChange({...p,asset:e.target.value as GooglePlayOptions['asset']||null})}><option value="">Seleccionar</option>{Object.entries(playAssets).filter(([key])=>p.type!=='graphics'||!['short_description','full_description'].includes(key)).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
 <label>Métrica en Play Console<select value={p.metric||''} onChange={e=>onChange({...p,metric:e.target.value as GooglePlayOptions['metric']||null})}><option value="">Seleccionar</option>{Object.entries(playMetrics).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
 <label>Audiencia experimental (%)<input type="number" min={1} max={99} value={p.audience??''} onChange={e=>onChange({...p,audience:e.target.value?Number(e.target.value):null})}/></label>
 <p className="small full">La ficha actual es el control. Añade una o dos variantes nuevas abajo; Google reparte la audiencia experimental entre ellas. Describe el control en Contexto y cambia un solo elemento por test. La aplicación y su ficha deben estar disponibles para experimentar. Usa Texto para la descripción que vas a probar y asigna los adjuntos desde los materiales del experimento.</p>
 </fieldset>;
}
