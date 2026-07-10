/** Zentrale Typdefinitionen der App */

/** Modus des Editors – bestimmt Voreinstellungen und Export-Verhalten */
export type EditorMode = 'sticker' | 'image' | 'profile' | 'meme';

/** Eine Text- oder Emoji-Ebene auf dem Canvas (Koordinaten in 512er-Welt) */
export interface TextLayer {
  id: string;
  kind: 'text' | 'emoji';
  text: string;
  x: number;
  y: number;
  /** Schriftgröße in Welt-Pixeln */
  size: number;
  /** Rotation in Radiant */
  rotation: number;
  font: string;
  color: string;
  strokeColor: string;
  /** Konturstärke in Prozent der Schriftgröße (0–30) */
  strokeWidth: number;
}

/** Transformation des Basisbildes innerhalb des 512er-Canvas */
export interface ImageTransform {
  x: number;
  y: number;
  scale: number;
  /** Nur 90°-Schritte für das Basisbild */
  rot: 0 | 90 | 180 | 270;
  flipX: boolean;
  flipY: boolean;
}

/** Serialisierbarer Editor-Zustand (ohne Bitmap-Daten) */
export interface EditorDoc {
  mode: EditorMode;
  /** Hintergrundfarbe oder null = transparent */
  bg: string | null;
  border: { enabled: boolean; color: string; width: number };
  image: ImageTransform | null;
  layers: TextLayer[];
  /** Rundes Zuschneiden (Profilbild) */
  round: boolean;
}

/** In IndexedDB gespeichertes Projekt */
export interface Project {
  id: string;
  name: string;
  mode: EditorMode;
  doc: EditorDoc;
  /** Bearbeitetes Bild (mit Radierer/Freistellung) als PNG */
  editedImage: Blob | null;
  /** Unverändertes Originalbild */
  originalImage: Blob | null;
  /** Kleine Vorschau (PNG, 160px) */
  thumbnail: Blob;
  createdAt: number;
  updatedAt: number;
}

export interface TemplateDef {
  id: string;
  name: string;
  emoji: string;
  text: string;
  font: string;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  bg: string | null;
  extraEmoji?: string;
}
