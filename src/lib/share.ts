/** Teilen über die Web Share API mit Download-Fallback */

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // URL erst nach kurzer Zeit freigeben, sonst bricht der Download auf iOS ab
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Versucht zu teilen (z. B. direkt an WhatsApp); wenn das Gerät kein Teilen
 * von Dateien unterstützt, wird stattdessen heruntergeladen.
 * Gibt zurück, ob geteilt (true) oder heruntergeladen (false) wurde.
 */
export async function shareOrDownload(blob: Blob, filename: string, title: string): Promise<boolean> {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return true;
    } catch (err) {
      // Abbruch durch Nutzer ist kein Fehler
      if ((err as DOMException)?.name === 'AbortError') return true;
    }
  }
  downloadBlob(blob, filename);
  return false;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
