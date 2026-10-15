/** Ergebnisse speichern oder über das Teilen-Menü des Geräts weitergeben */
import { zipSync } from 'fflate';

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function canShareFiles(): boolean {
  try {
    const probe = new File([new Uint8Array(1)], 'x.pdf', { type: 'application/pdf' });
    return !!navigator.canShare && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/** Teilt eine Datei; gibt false zurück, wenn der Nutzer abbricht oder Teilen nicht geht. */
export async function shareBlob(blob: Blob, filename: string): Promise<boolean> {
  const file = new File([blob], filename, { type: blob.type });
  try {
    await navigator.share({ files: [file], title: filename });
    return true;
  } catch {
    return false;
  }
}

/** Packt mehrere Dateien in ein ZIP (ohne Kompression – PDFs/Bilder sind bereits komprimiert). */
export async function zipFiles(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const entries: Record<string, [Uint8Array, { level: 0 }]> = {};
  const used = new Set<string>();
  for (const f of files) {
    let name = f.name;
    for (let i = 2; used.has(name); i++) name = f.name.replace(/(\.[^.]+)?$/, ` (${i})$1`);
    used.add(name);
    entries[name] = [new Uint8Array(await f.blob.arrayBuffer()), { level: 0 }];
  }
  return new Blob([zipSync(entries)], { type: 'application/zip' });
}
