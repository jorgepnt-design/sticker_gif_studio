/**
 * Kleiner IndexedDB-Wrapper ohne externe Abhängigkeiten.
 * Speichert Projekte lokal auf dem Gerät – nichts verlässt den Browser.
 */
import type { Project } from './types';

const DB_NAME = 'sticker-gif-studio';
const DB_VERSION = 1;

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
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB konnte nicht geöffnet werden'));
  });
  return dbPromise;
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
