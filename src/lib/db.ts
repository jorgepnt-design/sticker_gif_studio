/**
 * Kleiner IndexedDB-Wrapper ohne externe Abhängigkeiten.
 * Speichert Projekte lokal auf dem Gerät – nichts verlässt den Browser.
 */
import type { Project, LibrarySticker, StickerPack } from './types';

const DB_NAME = 'sticker-gif-studio';
const DB_VERSION = 2;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('projects')) {
        const store = db.createObjectStore('projects', { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
      // Version 2: Sticker-Bibliothek und Stickerpakete
      if (!db.objectStoreNames.contains('stickers')) {
        db.createObjectStore('stickers', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('packs')) {
        db.createObjectStore('packs', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB konnte nicht geöffnet werden'));
  });
  return dbPromise;
}

/** Generische Helfer für einfache Stores */
async function putIn(store: string, value: unknown): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).put(value as never);
  await txDone(tx);
}

async function getAllFrom<T>(store: string): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

async function deleteFrom(store: string, id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).delete(id);
  await txDone(tx);
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Datenbankfehler'));
    tx.onabort = () => reject(tx.error ?? new Error('Transaktion abgebrochen'));
  });
}

export async function saveProject(project: Project): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('projects', 'readwrite');
  tx.objectStore('projects').put(project);
  await txDone(tx);
}

export async function getProject(id: string): Promise<Project | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction('projects').objectStore('projects').get(id);
    req.onsuccess = () => resolve(req.result as Project | undefined);
    req.onerror = () => reject(req.error);
  });
}

/** Alle Projekte, neueste zuerst */
export async function listProjects(): Promise<Project[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction('projects').objectStore('projects').getAll();
    req.onsuccess = () => {
      const items = (req.result as Project[]).sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteProject(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('projects', 'readwrite');
  tx.objectStore('projects').delete(id);
  await txDone(tx);
}

/* ---------- Sticker-Bibliothek ---------- */

export const saveSticker = (s: LibrarySticker) => putIn('stickers', s);
export const deleteSticker = async (id: string) => {
  await deleteFrom('stickers', id);
  // Sticker auch aus allen Paketen entfernen
  const packs = await listPacks();
  for (const p of packs) {
    if (p.stickerIds.includes(id)) {
      await savePack({ ...p, stickerIds: p.stickerIds.filter((x) => x !== id), updatedAt: Date.now() });
    }
  }
};

/** Alle Bibliothek-Sticker, zuletzt verwendete zuerst */
export async function listStickers(): Promise<LibrarySticker[]> {
  const items = await getAllFrom<LibrarySticker>('stickers');
  return items.sort((a, b) => b.lastUsedAt - a.lastUsedAt);
}

export async function getSticker(id: string): Promise<LibrarySticker | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction('stickers').objectStore('stickers').get(id);
    req.onsuccess = () => resolve(req.result as LibrarySticker | undefined);
    req.onerror = () => reject(req.error);
  });
}

/* ---------- Stickerpakete ---------- */

export const savePack = (p: StickerPack) => putIn('packs', p);
export const deletePack = (id: string) => deleteFrom('packs', id);

export async function listPacks(): Promise<StickerPack[]> {
  const items = await getAllFrom<StickerPack>('packs');
  return items.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getPack(id: string): Promise<StickerPack | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction('packs').objectStore('packs').get(id);
    req.onsuccess = () => resolve(req.result as StickerPack | undefined);
    req.onerror = () => reject(req.error);
  });
}

/* ---------- Sicherung & Wiederherstellung (Vorstufe zur Cloud-Sync) ---------- */

function blobToB64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error ?? new Error('Blob konnte nicht gelesen werden'));
    fr.readAsDataURL(blob);
  });
}

async function b64ToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

/** Exportiert alle Projekte, Sticker, Pakete und Einstellungen als JSON-Datei. */
export async function exportAllData(): Promise<Blob> {
  const enc = async (b: Blob | null | undefined) => (b ? await blobToB64(b) : null);
  const projects = await Promise.all(
    (await listProjects()).map(async (p) => ({
      ...p,
      editedImage: await enc(p.editedImage),
      originalImage: await enc(p.originalImage),
      drawingImage: await enc(p.drawingImage),
      thumbnail: await enc(p.thumbnail),
    })),
  );
  const stickers = await Promise.all(
    (await listStickers()).map(async (s) => ({ ...s, blob: await enc(s.blob) })),
  );
  const data = {
    app: 'sticker-gif-studio',
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    settings: localStorage.getItem('sgs-settings'),
    projects,
    stickers,
    packs: await listPacks(),
  };
  return new Blob([JSON.stringify(data)], { type: 'application/json' });
}

/** Liest eine Sicherungsdatei ein; vorhandene Einträge mit gleicher ID werden überschrieben. */
export async function importAllData(
  file: Blob,
): Promise<{ projects: number; stickers: number; packs: number }> {
  const data = JSON.parse(await file.text()) as {
    app?: string;
    settings?: string | null;
    projects?: Array<Record<string, unknown>>;
    stickers?: Array<Record<string, unknown>>;
    packs?: StickerPack[];
  };
  if (data.app !== 'sticker-gif-studio') {
    throw new Error('Keine gültige Sicherungsdatei');
  }
  const dec = async (s: unknown) => (typeof s === 'string' ? await b64ToBlob(s) : null);
  const counts = { projects: 0, stickers: 0, packs: 0 };
  for (const p of data.projects ?? []) {
    const thumbnail = await dec(p.thumbnail);
    if (!thumbnail) continue;
    await saveProject({
      ...(p as unknown as Project),
      editedImage: await dec(p.editedImage),
      originalImage: await dec(p.originalImage),
      drawingImage: await dec(p.drawingImage),
      thumbnail,
    });
    counts.projects++;
  }
  for (const s of data.stickers ?? []) {
    const blob = await dec(s.blob);
    if (!blob) continue;
    await saveSticker({ ...(s as unknown as LibrarySticker), blob });
    counts.stickers++;
  }
  for (const pack of data.packs ?? []) {
    await savePack(pack);
    counts.packs++;
  }
  if (typeof data.settings === 'string') localStorage.setItem('sgs-settings', data.settings);
  return counts;
}

/** Löscht sämtliche lokal gespeicherten Daten (Projekte, Einstellungen, Caches). */
export async function wipeAllData(): Promise<void> {
  if (dbPromise) {
    try {
      (await dbPromise).close();
    } catch {
      /* ignorieren */
    }
    dbPromise = null;
  }
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
  localStorage.clear();
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }
}
