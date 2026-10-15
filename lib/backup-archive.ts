import { archiveName, backupJson, type Backup } from "./backup";
import type { Attachment } from "./attachments";

export async function createBackupArchive(backup: Backup, filename: string, document: Uint8Array,
  download: (attachment: Attachment) => Promise<Uint8Array>, progress: (message: string) => void,downloadDocument?:(document:Record<string,unknown>)=>Promise<Uint8Array>): Promise<Uint8Array> {
  const { zipSync, strToU8 } = await import("fflate");
  const files: Record<string, Uint8Array> = { [filename]: document, "datos-completos.json": strToU8(backupJson(backup)) };
  const originals = backup.attachments.filter(a => a.kind !== "link");
  for (let i = 0; i < originals.length; i++) {
    const attachment = originals[i]; progress(`Descargando adjunto ${i + 1} de ${originals.length}…`);
    const data = await download(attachment);
    if (!data.length || (attachment.size != null && data.length !== attachment.size)) throw new Error("No se ha podido descargar completo el archivo «" + attachment.name + "». La copia no se ha generado; vuelve a intentarlo.");
    files[`adjuntos/${archiveName(attachment.record_id)}/${archiveName(attachment.id)}-${archiveName(attachment.name)}`] = data;
  }
  files["LEEME.txt"] = strToU8("Experimental Operative System - Imagine Builder\nCopia del " + backup.exported_at + "\n\nEl documento contiene todos los proyectos, fichas, GOI Tree, equipo e historial.\nDatos-completos.json conserva los datos estructurados y las relaciones.\nLa carpeta adjuntos contiene los archivos originales con su ID y ficha.\nLas cuentas de acceso y las contraseñas no se incluyen. No hay restauración automática.\n");
  for(const doc of backup.monitoring?.ai_documents||[]){
    if(!downloadDocument)throw new Error('Falta configurar la descarga de los originales de la memoria. No se ha generado una copia incompleta.');
    const bytes=await downloadDocument(doc);if(!bytes.length||bytes.length!==Number(doc.size))throw new Error(`El original de memoria «${doc.name}» está incompleto. No se ha generado la copia.`);
    files[`memoria/${archiveName(String(doc.id))}-${archiveName(String(doc.name))}`]=bytes;
  }
  progress("Preparando el archivo ZIP…");
  return zipSync(files, { level: 1 });
}
