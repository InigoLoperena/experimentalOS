'use client';
import {useState} from 'react';
import type {Item} from '@/lib/model';
import {googlePlayPreparation} from '@/lib/google-play-preparation';
export function GooglePlayPreparation({experiment,code}:{experiment:Item;code:string}){
 const [message,setMessage]=useState('');
 if(experiment.fields.channel!=='google_play')return null;
 let bundle:ReturnType<typeof googlePlayPreparation>|null=null,error='';
 try{bundle=googlePlayPreparation(experiment,code);}catch(e){error=e instanceof Error?e.message:'Revisa la preparación.';}
 const guide=bundle?[`Experimento: ${bundle.name}`,`Referencia: ${bundle.code}`,`Control: ${bundle.control}`,`Tipo: ${bundle.type==='localized'?'Ficha localizada':'Gráficos de la ficha predeterminada'}`,`Idioma: ${bundle.language}`,`Elemento: ${bundle.asset}`,`Métrica: ${bundle.metric}`,`Audiencia experimental: ${bundle.experimental_audience}%`,`Hipótesis: ${bundle.hypothesis}`,`Criterio de éxito: ${bundle.success_criterion}`,...bundle.variants.map(v=>`\n${v.label}\nReferencia local: ${v.reference}\nTexto: ${v.text||'No aplica'}\nMateriales: ${v.materials.join(', ')||'No aplica'}`),`\n${bundle.instructions}`].join('\n'):'';
 return <section className="monitoring-block"><h3>Google Play · preparación y resultados</h3>
 <p className="small">Los tests de la ficha se crean y revisan en Play Console. Esta preparación no publica ni modifica tu aplicación.</p>
 {error&&<p className="notice">{error}</p>}
 {bundle&&<><pre className="execution-summary">{guide}</pre><button className="btn" type="button" onClick={()=>{const url=URL.createObjectURL(new Blob([guide],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`${code}-google-play.txt`;a.click();URL.revokeObjectURL(url);setMessage('Guía descargada. Los archivos originales siguen en los adjuntos privados.');}}>Descargar preparación para Play Console</button></>}
 <p><a href="https://play.google.com/console/" target="_blank" rel="noreferrer">Abrir Play Console</a></p>
 <p className="small">En Recursos externos, selecciona Otra plataforma y tipo Experimento. Añade un recurso por variante y asígnalo a su variante interna. Puedes usar las referencias de la guía como IDs locales y guardar la URL real del test. Incluye también un recurso para el control si importas su resultado.</p>
 <p className="small">En Resultados, introduce las métricas manualmente o usa la plantilla CSV existente con esos IDs. Conserva el mismo periodo y añade idioma, audiencia y fuente en las notas. Registra clics de instalación, apertura o registro previo como recuentos; no los confundas con conversiones del producto. Importar resultados no determina por sí solo un ganador: conserva la conclusión y el intervalo de confianza de Play Console en los aprendizajes.</p>
 {message&&<p role="status">{message}</p>}
 </section>;
}
