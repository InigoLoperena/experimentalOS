import { PluginPage } from '../plugin-page';
import { SaveExperimentReview } from './save-review';
export const metadata = { title: 'Revisar y guardar experimento · Xperiments', robots: { index: false, follow: false }, referrer: 'no-referrer' as const };
export default function SavePluginExperiment() {
  return <PluginPage path="/plugins/validacion-de-negocios/guardar" eyebrow="DE CHATGPT A TU PROYECTO" title="Revisar y guardar experimento"
    intro="Comprueba la ficha, elige el proyecto y confirma. Solo se guardará cuando pulses el botón; no se activará ninguna campaña.">
    <SaveExperimentReview />
  </PluginPage>;
}
