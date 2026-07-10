/**
 * Der Sticker-Editor: Canvas-Rendering, Touch-Gesten (Ziehen, Pinch-Zoom,
 * Drehen), Freistellen, Text/Emoji-Ebenen, Rand, Export und Projekt-Speicherung.
 *
 * Koordinatensystem: Alle Positionen sind "Welt-Koordinaten" (512×512),
 * unabhängig von der tatsächlichen Anzeigegröße auf dem Bildschirm.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Undo2,
  Redo2,
  Save,
  Share2,
  ImagePlus,
  Camera,
  Type as TypeIcon,
  Loader2,
  Eye,
} from 'lucide-react';
import { navigate } from '../../lib/router';
import { useToast } from '../../components/Toast';
import { Modal, InputModal } from '../../components/Modal';
import { EditorPanels, type Tab } from './EditorPanels';
import { ExportSheet } from './ExportSheet';
import {
  WORLD,
  MAX_FILE_BYTES,
  loadImageToCanvas,
  cloneCanvas,
  autoRemoveBackground,
  brushStroke,
  composeDoc,
  measureTextLayer,
  makeThumbnail,
  encodeCanvas,
  uid,
  ctx2d,
  createCanvas,
  applyAdjustments,
  isNeutralAdjust,
  NEUTRAL_ADJUST,
  applyFilterPreset,
  type FilterPreset,
} from '../../lib/imaging';
import { getProject, saveProject } from '../../lib/db';
import { TEMPLATES, FONTS } from '../../lib/templates';
import type { EditorDoc, EditorMode, ImageTransform, TextLayer, Project } from '../../lib/types';

const MODE_TITLE: Record<EditorMode, string> = {
  sticker: 'Sticker erstellen',
  meme: 'Meme erstellen',
  image: 'Bild bearbeiten',
  profile: 'Profilbild erstellen',
};

function defaultDoc(mode: EditorMode): EditorDoc {
  return {
    mode,
    bg: mode === 'profile' ? '#ffffff' : null,
    border: {
      enabled: mode === 'sticker' || mode === 'profile',
      color: mode === 'profile' ? '#10b981' : '#ffffff',
      width: mode === 'profile' ? 16 : 10,
    },
    shadow: { enabled: false, blur: 8, offset: 4 },
    adjust: { ...NEUTRAL_ADJUST },
    image: null,
    layers: [],
    round: mode === 'profile',
  };
}

function fitTransform(img: HTMLCanvasElement, cover: boolean): ImageTransform {
  const s = cover
    ? Math.max(WORLD / img.width, WORLD / img.height)
    : Math.min(WORLD / img.width, WORLD / img.height) * 0.94;
  return { x: WORLD / 2, y: WORLD / 2, scale: s, rot: 0, flipX: false, flipY: false };
}

function memeLayers(): TextLayer[] {
  const base = {
    kind: 'text' as const,
    x: WORLD / 2,
    rotation: 0,
    size: 48,
    font: FONTS[1].value,
    color: '#ffffff',
    strokeColor: '#111827',
    strokeWidth: 16,
  };
  return [
    { ...base, id: uid(), text: 'OBERER TEXT', y: 56 },
    { ...base, id: uid(), text: 'UNTERER TEXT', y: WORLD - 56 },
  ];
}

/** Weltpunkt in Bild-Pixelkoordinaten umrechnen (für den Radierer) */
function worldToImage(pt: { x: number; y: number }, t: ImageTransform, img: HTMLCanvasElement) {
  const dx = pt.x - t.x;
  const dy = pt.y - t.y;
  const rad = (-t.rot * Math.PI) / 180;
  const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
  const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
  return {
    x: rx / (t.scale * (t.flipX ? -1 : 1)) + img.width / 2,
    y: ry / (t.scale * (t.flipY ? -1 : 1)) + img.height / 2,
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

type EditorTool = 'move' | 'erase' | 'restore' | 'lasso' | 'draw' | 'drawErase';

type Gesture =
  | { kind: 'brush'; last: { x: number; y: number } }
  | { kind: 'lasso'; points: { x: number; y: number }[] }
  | { kind: 'draw'; last: { x: number; y: number } }
  | { kind: 'drag'; target: 'image' | string; start: { x: number; y: number }; orig: { x: number; y: number } }
  | {
      kind: 'pinch';
      target: 'image' | string;
      startDist: number;
      startAngle: number;
      origScale: number;
      origSize: number;
      origRot: number;
      center0: { x: number; y: number };
      orig: { x: number; y: number };
    };

export function EditorPage({ params }: { params: URLSearchParams }) {
  const toast = useToast();
  const initialMode = (params.get('mode') as EditorMode) || 'sticker';

  const [doc, setDocState] = useState<EditorDoc>(() => defaultDoc(initialMode));
  const [hasImage, setHasImage] = useState(false);
  const [busy, setBusy] = useState<string | null>(params.get('p') ? 'Projekt wird geladen …' : null);
  const [version, setVersion] = useState(0); // erzwingt Neuzeichnen nach Bitmap-Änderungen
  const [, setRenderTick] = useState(0); // Neuzeichnen nach Filter-Neuberechnung
  const [selection, setSelection] = useState<'image' | string | null>(null);
  const [tab, setTabState] = useState<Tab>('text');
  const [tool, setTool] = useState<EditorTool>('move');
  const [brushSize, setBrushSize] = useState(30);
  const [tolerance, setTolerance] = useState(30);
  const [drawColor, setDrawColor] = useState('#ef4444');
  const [drawSize, setDrawSize] = useState(10);
  const [showOriginal, setShowOriginal] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [textModal, setTextModal] = useState<{ layerId?: string } | null>(null);
  const [confirmBack, setConfirmBack] = useState(false);

  // Bitmap-Daten leben außerhalb des React-States (performance-kritisch)
  const imageRef = useRef<HTMLCanvasElement | null>(null);
  const originalRef = useRef<HTMLCanvasElement | null>(null);
  /** Bild mit angewendeten Anpassungen (Cache); bei neutralen Werten = imageRef */
  const filteredRef = useRef<HTMLCanvasElement | null>(null);
  const filteredOrigRef = useRef<HTMLCanvasElement | null>(null);
  /** Freihand-Zeichnung (512×512 Welt-Koordinaten) */
  const drawingRef = useRef<HTMLCanvasElement | null>(null);
  const lassoPointsRef = useRef<{ x: number; y: number }[]>([]);
  const displayRef = useRef<HTMLCanvasElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const undoStack = useRef<ImageData[]>([]);
  const redoStack = useRef<ImageData[]>([]);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = useRef<Gesture | null>(null);
  const gestureActive = useRef(false);
  const dirtyRef = useRef(false);
  const projectRef = useRef<{ id: string; name: string; createdAt: number } | null>(null);
  const initRef = useRef(false);

  const bump = () => setVersion((v) => v + 1);

  const setDoc = useCallback((updater: (d: EditorDoc) => EditorDoc) => {
    dirtyRef.current = true;
    setDocState(updater);
  }, []);

  const setTab = (t: Tab) => {
    setTabState(t);
    setTool(t === 'cutout' ? 'erase' : t === 'draw' ? 'draw' : 'move');
  };

  /* ---------- Anpassungen: gefilterte Bild-Kopie im Cache halten ---------- */
  useEffect(() => {
    if (gestureActive.current) return; // während einer Geste nicht neu rechnen
    const img = imageRef.current;
    const orig = originalRef.current;
    if (!img) {
      filteredRef.current = null;
      filteredOrigRef.current = null;
      return;
    }
    if (isNeutralAdjust(doc.adjust)) {
      filteredRef.current = img;
      filteredOrigRef.current = orig;
      setRenderTick((t) => t + 1);
      return;
    }
    // kurz entprellen, damit Slider flüssig bleiben
    const timer = setTimeout(() => {
      filteredRef.current = applyAdjustments(img, doc.adjust);
      filteredOrigRef.current = orig ? applyAdjustments(orig, doc.adjust) : null;
      setRenderTick((t) => t + 1);
    }, 120);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.adjust, version, hasImage]);

  /* ---------- Initialisierung (Projekt / Vorlage / Text-Start) ---------- */
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    const pid = params.get('p');
    const templateId = params.get('template');
    if (pid) {
      void (async () => {
        try {
          const p = await getProject(pid);
          if (!p) {
            toast('Projekt nicht gefunden', 'error');
            navigate('/projects');
            return;
          }
          projectRef.current = { id: p.id, name: p.name, createdAt: p.createdAt };
          if (p.editedImage) {
            imageRef.current = await loadImageToCanvas(p.editedImage);
            originalRef.current = p.originalImage
              ? await loadImageToCanvas(p.originalImage)
              : cloneCanvas(imageRef.current);
            setHasImage(true);
            setTabState('image');
          }
          if (p.drawingImage) {
            drawingRef.current = await loadImageToCanvas(p.drawingImage);
          }
          // Ältere Projekte um neue Felder (Schatten, Anpassungen) ergänzen
          setDocState({ ...defaultDoc(p.doc.mode), ...p.doc });
        } catch {
          toast('Projekt konnte nicht geladen werden', 'error');
        } finally {
          setBusy(null);
        }
      })();
    } else if (templateId) {
      const t = TEMPLATES.find((x) => x.id === templateId);
      if (t) {
        const layers: TextLayer[] = [
          {
            id: uid(),
            kind: 'text',
            text: t.text,
            x: WORLD / 2,
            y: WORLD / 2 - 30,
            size: 78,
            rotation: 0,
            font: t.font,
            color: t.color,
            strokeColor: t.strokeColor,
            strokeWidth: t.strokeWidth,
          },
          ...(t.extraEmoji
            ? [
                {
                  id: uid(),
                  kind: 'emoji' as const,
                  text: t.extraEmoji,
                  x: WORLD / 2,
                  y: WORLD - 110,
                  size: 120,
                  rotation: 0,
                  font: 'system-ui',
                  color: '#000',
                  strokeColor: '#000',
                  strokeWidth: 0,
                },
              ]
            : []),
        ];
        setDocState((d) => ({ ...d, bg: t.bg, layers }));
      }
    } else if (params.get('text') === '1') {
      setTextModal({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Bild laden ---------- */
  const pickImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast('Bitte eine Bilddatei auswählen', 'error');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast('Bild ist zu groß (max. 25 MB)', 'error');
      return;
    }
    setBusy('Bild wird geladen …');
    try {
      const c = await loadImageToCanvas(file);
      imageRef.current = c;
      originalRef.current = cloneCanvas(c);
      undoStack.current = [];
      redoStack.current = [];
      setHasImage(true);
      setDoc((d) => ({
        ...d,
        image: fitTransform(c, d.mode === 'meme' || d.mode === 'profile'),
        layers: d.mode === 'meme' && d.layers.length === 0 ? memeLayers() : d.layers,
      }));
      setSelection('image');
      setTabState('image');
      setTool('move');
    } catch {
      toast('Bild konnte nicht geladen werden', 'error');
    } finally {
      setBusy(null);
    }
  };

  /* ---------- Bitmap-Operationen (Undo-fähig) ---------- */
  const pushUndo = () => {
    const img = imageRef.current;
    if (!img) return;
    undoStack.current.push(ctx2d(img).getImageData(0, 0, img.width, img.height));
    if (undoStack.current.length > 5) undoStack.current.shift(); // Speicher begrenzen
    redoStack.current = [];
  };

  const undo = () => {
    const img = imageRef.current;
    const prev = undoStack.current.pop();
    if (!img || !prev) return;
    redoStack.current.push(ctx2d(img).getImageData(0, 0, img.width, img.height));
    ctx2d(img).putImageData(prev, 0, 0);
    dirtyRef.current = true;
    bump();
  };

  const redo = () => {
    const img = imageRef.current;
    const next = redoStack.current.pop();
    if (!img || !next) return;
    undoStack.current.push(ctx2d(img).getImageData(0, 0, img.width, img.height));
    ctx2d(img).putImageData(next, 0, 0);
    dirtyRef.current = true;
    bump();
  };

  const onAutoRemove = () => {
    const img = imageRef.current;
    if (!img) return;
    pushUndo();
    setBusy('Hintergrund wird entfernt …');
    // kurzes Timeout, damit die Ladeanzeige gezeichnet wird
    setTimeout(() => {
      try {
        autoRemoveBackground(img, tolerance);
        dirtyRef.current = true;
        toast('Hintergrund entfernt', 'success');
      } catch {
        toast('Freistellen fehlgeschlagen', 'error');
      } finally {
        setBusy(null);
        bump();
      }
    }, 60);
  };

  const onResetImage = () => {
    const img = imageRef.current;
    const orig = originalRef.current;
    if (!img || !orig) return;
    pushUndo();
    const ctx = ctx2d(img);
    ctx.clearRect(0, 0, img.width, img.height);
    ctx.drawImage(orig, 0, 0);
    dirtyRef.current = true;
    bump();
  };

  /* ---------- Ebenen ---------- */
  const selectedLayer = doc.layers.find((l) => l.id === selection) ?? null;

  const updateLayer = (id: string, patch: Partial<TextLayer>) =>
    setDoc((d) => ({ ...d, layers: d.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));

  const removeLayer = (id: string) => {
    setDoc((d) => ({ ...d, layers: d.layers.filter((l) => l.id !== id) }));
    setSelection(null);
  };

  const addTextLayer = (text: string) => {
    const layer: TextLayer = {
      id: uid(),
      kind: 'text',
      text,
      x: WORLD / 2,
      y: WORLD / 2,
      size: 64,
      rotation: 0,
      font: FONTS[1].value,
      color: '#ffffff',
      strokeColor: '#111827',
      strokeWidth: 12,
    };
    setDoc((d) => ({ ...d, layers: [...d.layers, layer] }));
    setSelection(layer.id);
    setTabState('text');
    setTool('move');
  };

  const addEmoji = (emoji: string) => {
    const layer: TextLayer = {
      id: uid(),
      kind: 'emoji',
      text: emoji,
      x: WORLD / 2 + (Math.random() * 60 - 30),
      y: WORLD / 2 + (Math.random() * 60 - 30),
      size: 120,
      rotation: 0,
      font: 'system-ui',
      color: '#000000',
      strokeColor: '#000000',
      strokeWidth: 0,
    };
    setDoc((d) => ({ ...d, layers: [...d.layers, layer] }));
    setSelection(layer.id);
    setTool('move');
  };

  /* ---------- Bild-Transformationen ---------- */
  const rotate = (dir: 1 | -1) =>
    setDoc((d) =>
      d.image ? { ...d, image: { ...d.image, rot: (((d.image.rot + dir * 90) % 360) + 360) % 360 as 0 | 90 | 180 | 270 } } : d,
    );
  const flip = (axis: 'x' | 'y') =>
    setDoc((d) =>
      d.image
        ? { ...d, image: { ...d.image, flipX: axis === 'x' ? !d.image.flipX : d.image.flipX, flipY: axis === 'y' ? !d.image.flipY : d.image.flipY } }
        : d,
    );
  const fitImage = (cover: boolean) => {
    const img = imageRef.current;
    if (!img) return;
    setDoc((d) => ({ ...d, image: fitTransform(img, cover) }));
  };

  /* ---------- Treffer-Erkennung & Gesten ---------- */
  const worldPoint = (e: { clientX: number; clientY: number }) => {
    const c = displayRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * WORLD, y: ((e.clientY - r.top) / r.height) * WORLD };
  };

  const hitTest = (pt: { x: number; y: number }): 'image' | string | null => {
    // Ebenen von oben nach unten prüfen
    for (let i = doc.layers.length - 1; i >= 0; i--) {
      const l = doc.layers[i];
      const m = measureTextLayer(l);
      const pad = l.size * 0.2;
      const dx = pt.x - l.x;
      const dy = pt.y - l.y;
      const cos = Math.cos(-l.rotation);
      const sin = Math.sin(-l.rotation);
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      if (Math.abs(lx) <= m.w / 2 + pad && Math.abs(ly) <= m.h / 2 + pad) return l.id;
    }
    if (hasImage && doc.image && imageRef.current) {
      const p = worldToImage(pt, doc.image, imageRef.current);
      const img = imageRef.current;
      if (p.x >= 0 && p.x <= img.width && p.y >= 0 && p.y <= img.height) return 'image';
    }
    return null;
  };

  const applyBrush = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const img = imageRef.current;
    const orig = originalRef.current;
    if (!img || !orig || !doc.image) return;
    const t = doc.image;
    const a = worldToImage(from, t, img);
    const b = worldToImage(to, t, img);
    const r = brushSize / 2 / t.scale;
    const mode = tool === 'erase' ? 'erase' : 'restore';
    brushStroke(img, orig, a, b, r, mode);
    // Gefilterte Kopie parallel bearbeiten, damit die Vorschau sofort stimmt
    if (filteredRef.current && filteredRef.current !== img && filteredOrigRef.current) {
      brushStroke(filteredRef.current, filteredOrigRef.current, a, b, r, mode);
    }
    dirtyRef.current = true;
    bump();
  };

  const applyLassoSelection = (points: { x: number; y: number }[]) => {
    const img = imageRef.current;
    if (!img || !doc.image || points.length < 3) {
      lassoPointsRef.current = [];
      return;
    }

    const imagePoints = points.map((p) => worldToImage(p, doc.image!, img));
    const xs = imagePoints.map((p) => p.x);
    const ys = imagePoints.map((p) => p.y);
    const hasArea = Math.max(...xs) - Math.min(...xs) > 3 && Math.max(...ys) - Math.min(...ys) > 3;
    if (!hasArea) {
      lassoPointsRef.current = [];
      toast('Freihand-Auswahl war zu klein', 'error');
      return;
    }

    pushUndo();
    const mask = createCanvas(img.width, img.height);
    const mctx = ctx2d(mask);
    mctx.beginPath();
    mctx.moveTo(imagePoints[0].x, imagePoints[0].y);
    for (const p of imagePoints.slice(1)) mctx.lineTo(p.x, p.y);
    mctx.closePath();
    mctx.fillStyle = '#000';
    mctx.fill();

    const applyMask = (target: HTMLCanvasElement) => {
      const tctx = ctx2d(target);
      tctx.save();
      tctx.globalCompositeOperation = 'destination-in';
      tctx.drawImage(mask, 0, 0);
      tctx.restore();
    };

    applyMask(img);
    if (filteredRef.current && filteredRef.current !== img) applyMask(filteredRef.current);
    dirtyRef.current = true;
    lassoPointsRef.current = [];
    toast('Freihand-Auswahl angewendet', 'success');
    bump();
  };

  /** Freihand-Zeichnen / Zeichnung radieren (in Welt-Koordinaten) */
  const applyDraw = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    if (!drawingRef.current) drawingRef.current = createCanvas(WORLD, WORLD);
    const ctx = ctx2d(drawingRef.current);
    ctx.save();
    if (tool === 'drawErase') ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = drawColor;
    ctx.fillStyle = drawColor;
    ctx.lineWidth = drawSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (from.x === to.x && from.y === to.y) {
      ctx.beginPath();
      ctx.arc(from.x, from.y, drawSize / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
    ctx.restore();
    dirtyRef.current = true;
    bump();
  };

  const clearDrawing = () => {
    if (!drawingRef.current) return;
    ctx2d(drawingRef.current).clearRect(0, 0, WORLD, WORLD);
    dirtyRef.current = true;
    bump();
  };

  /** Filter-Preset destruktiv anwenden (mit Undo-Schnappschuss) */
  const onApplyFilter = (preset: FilterPreset) => {
    const img = imageRef.current;
    if (!img) return;
    pushUndo();
    setBusy('Filter wird angewendet …');
    setTimeout(() => {
      try {
        applyFilterPreset(img, preset);
        dirtyRef.current = true;
      } catch {
        toast('Filter fehlgeschlagen', 'error');
      } finally {
        setBusy(null);
        bump();
      }
    }, 60);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    try {
      displayRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // Pointer bereits beendet (z. B. sehr kurzes Tippen) – Geste trotzdem starten
    }
    const pt = worldPoint(e);
    pointers.current.set(e.pointerId, pt);
    gestureActive.current = true;

    if (pointers.current.size === 1) {
      if (tool === 'draw' || tool === 'drawErase') {
        gestureRef.current = { kind: 'draw', last: pt };
        applyDraw(pt, pt);
      } else if (tool === 'lasso') {
        if (hasImage) {
          lassoPointsRef.current = [pt];
          gestureRef.current = { kind: 'lasso', points: lassoPointsRef.current };
          bump();
        }
      } else if (tool !== 'move') {
        if (hasImage) {
          pushUndo();
          gestureRef.current = { kind: 'brush', last: pt };
          applyBrush(pt, pt);
        }
      } else {
        const target = hitTest(pt);
        setSelection(target);
        if (target === 'image' && doc.image) {
          gestureRef.current = { kind: 'drag', target, start: pt, orig: { x: doc.image.x, y: doc.image.y } };
        } else if (target && target !== 'image') {
          const l = doc.layers.find((x) => x.id === target)!;
          gestureRef.current = { kind: 'drag', target, start: pt, orig: { x: l.x, y: l.y } };
        } else {
          gestureRef.current = null;
        }
      }
    } else if (pointers.current.size === 2 && tool === 'move') {
      const [a, b] = [...pointers.current.values()];
      const prev = gestureRef.current;
      const target = prev && (prev.kind === 'drag' || prev.kind === 'pinch') ? prev.target : selection;
      if (!target) return;
      const startDist = Math.max(10, Math.hypot(b.x - a.x, b.y - a.y));
      const startAngle = Math.atan2(b.y - a.y, b.x - a.x);
      const center0 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (target === 'image' && doc.image) {
        gestureRef.current = {
          kind: 'pinch', target, startDist, startAngle, center0,
          origScale: doc.image.scale, origSize: 0, origRot: 0,
          orig: { x: doc.image.x, y: doc.image.y },
        };
      } else {
        const l = doc.layers.find((x) => x.id === target);
        if (!l) return;
        gestureRef.current = {
          kind: 'pinch', target, startDist, startAngle, center0,
          origScale: 1, origSize: l.size, origRot: l.rotation,
          orig: { x: l.x, y: l.y },
        };
      }
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const pt = worldPoint(e);
    pointers.current.set(e.pointerId, pt);
    const g = gestureRef.current;
    if (!g) return;

    if (g.kind === 'brush') {
      applyBrush(g.last, pt);
      g.last = pt;
    } else if (g.kind === 'lasso') {
      const last = g.points[g.points.length - 1];
      if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) > 2) {
        g.points.push(pt);
        lassoPointsRef.current = g.points;
        bump();
      }
    } else if (g.kind === 'draw') {
      applyDraw(g.last, pt);
      g.last = pt;
    } else if (g.kind === 'drag' && pointers.current.size === 1) {
      const dx = pt.x - g.start.x;
      const dy = pt.y - g.start.y;
      if (g.target === 'image') {
        setDoc((d) => (d.image ? { ...d, image: { ...d.image, x: g.orig.x + dx, y: g.orig.y + dy } } : d));
      } else {
        updateLayer(g.target, { x: g.orig.x + dx, y: g.orig.y + dy });
      }
    } else if (g.kind === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.max(10, Math.hypot(b.x - a.x, b.y - a.y));
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const f = dist / g.startDist;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const dx = mid.x - g.center0.x;
      const dy = mid.y - g.center0.y;
      if (g.target === 'image') {
        setDoc((d) =>
          d.image
            ? { ...d, image: { ...d.image, scale: clamp(g.origScale * f, 0.05, 6), x: g.orig.x + dx, y: g.orig.y + dy } }
            : d,
        );
      } else {
        updateLayer(g.target, {
          size: clamp(g.origSize * f, 12, 400),
          rotation: g.origRot + (angle - g.startAngle),
          x: g.orig.x + dx,
          y: g.orig.y + dy,
        });
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = gestureRef.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      if (g?.kind === 'lasso') applyLassoSelection(g.points);
      gestureRef.current = null;
      gestureActive.current = false;
      bump(); // einmal in hoher Qualität nachzeichnen
    } else if (gestureRef.current?.kind === 'pinch') {
      gestureRef.current = null;
    }
  };

  /* ---------- Rendering ---------- */
  useEffect(() => {
    const c = displayRef.current;
    if (!c) return;

    // Vorher-Ansicht: unbearbeitetes Original eingepasst anzeigen
    if (showOriginal && originalRef.current) {
      const ctx = ctx2d(c);
      ctx.clearRect(0, 0, c.width, c.height);
      const orig = originalRef.current;
      const s = Math.min(c.width / orig.width, c.height / orig.height) * 0.94;
      ctx.drawImage(
        orig,
        (c.width - orig.width * s) / 2,
        (c.height - orig.height * s) / 2,
        orig.width * s,
        orig.height * s,
      );
      return;
    }

    composeDoc(
      c,
      doc,
      hasImage ? (filteredRef.current ?? imageRef.current) : null,
      gestureActive.current ? 'fast' : 'high',
      drawingRef.current,
    );

    // Auswahl-Rahmen zeichnen (nur im Verschieben-Modus)
    if (tool === 'move' && selection) {
      const ctx = ctx2d(c);
      const s = c.width / WORLD;
      ctx.save();
      ctx.scale(s, s);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      if (selection === 'image' && doc.image && imageRef.current) {
        const t = doc.image;
        const img = imageRef.current;
        ctx.translate(t.x, t.y);
        ctx.rotate((t.rot * Math.PI) / 180);
        ctx.strokeRect((-img.width * t.scale) / 2, (-img.height * t.scale) / 2, img.width * t.scale, img.height * t.scale);
      } else if (selectedLayer) {
        const m = measureTextLayer(selectedLayer);
        const pad = selectedLayer.size * 0.15;
        ctx.translate(selectedLayer.x, selectedLayer.y);
        ctx.rotate(selectedLayer.rotation);
        ctx.strokeRect(-(m.w / 2 + pad), -(m.h / 2 + pad), m.w + pad * 2, m.h + pad * 2);
      }
      ctx.restore();
    }

    if (tool === 'lasso' && lassoPointsRef.current.length > 1) {
      const ctx = ctx2d(c);
      const s = c.width / WORLD;
      const points = lassoPointsRef.current;
      ctx.save();
      ctx.scale(s, s);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([10, 6]);
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.restore();
    }
  });

  /* ---------- Projekt speichern ---------- */
  const save = async () => {
    setBusy('Projekt wird gespeichert …');
    try {
      const img = hasImage ? imageRef.current : null;
      const project: Project = {
        id: projectRef.current?.id ?? uid(),
        name:
          projectRef.current?.name ??
          `${MODE_TITLE[doc.mode].split(' ')[0]} vom ${new Date().toLocaleDateString('de-DE')}`,
        mode: doc.mode,
        doc,
        editedImage: img ? await encodeCanvas(img, 'png', 1) : null,
        originalImage: originalRef.current ? await encodeCanvas(originalRef.current, 'png', 1) : null,
        drawingImage: drawingRef.current ? await encodeCanvas(drawingRef.current, 'png', 1) : null,
        thumbnail: await makeThumbnail(doc, hasImage ? (filteredRef.current ?? img) : null, drawingRef.current),
        createdAt: projectRef.current?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      };
      await saveProject(project);
      projectRef.current = { id: project.id, name: project.name, createdAt: project.createdAt };
      dirtyRef.current = false;
      toast('Projekt gespeichert', 'success');
    } catch {
      toast('Speichern fehlgeschlagen', 'error');
    } finally {
      setBusy(null);
    }
  };

  const goBack = () => {
    if (dirtyRef.current) setConfirmBack(true);
    else navigate('/');
  };

  const showUploadScreen = !hasImage && doc.layers.length === 0 && !busy;

  return (
    <div className="flex h-dvh flex-col bg-slate-100 dark:bg-[#0d1117]">
      {/* Kopfleiste */}
      <header className="flex items-center gap-1 border-b border-slate-200 bg-white px-2 py-2 safe-top dark:border-slate-700 dark:bg-slate-900">
        <button onClick={goBack} className="rounded-xl p-2.5 active:bg-slate-100 dark:active:bg-slate-800" aria-label="Zurück">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-base font-bold">{MODE_TITLE[doc.mode]}</h1>
        {hasImage && (
          <button
            onPointerDown={() => setShowOriginal(true)}
            onPointerUp={() => setShowOriginal(false)}
            onPointerLeave={() => setShowOriginal(false)}
            className={`rounded-xl p-2.5 ${showOriginal ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'active:bg-slate-100 dark:active:bg-slate-800'}`}
            aria-label="Original anzeigen (gedrückt halten)"
          >
            <Eye className="h-5 w-5" />
          </button>
        )}
        <button
          onClick={undo}
          disabled={undoStack.current.length === 0}
          className="rounded-xl p-2.5 active:bg-slate-100 disabled:opacity-30 dark:active:bg-slate-800"
          aria-label="Rückgängig"
        >
          <Undo2 className="h-5 w-5" />
        </button>
        <button
          onClick={redo}
          disabled={redoStack.current.length === 0}
          className="rounded-xl p-2.5 active:bg-slate-100 disabled:opacity-30 dark:active:bg-slate-800"
          aria-label="Wiederholen"
        >
          <Redo2 className="h-5 w-5" />
        </button>
        <button onClick={save} className="rounded-xl p-2.5 active:bg-slate-100 dark:active:bg-slate-800" aria-label="Projekt speichern">
          <Save className="h-5 w-5" />
        </button>
        <button
          onClick={() => setShowExport(true)}
          className="ml-1 flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-sm font-bold text-white shadow active:scale-95"
        >
          <Share2 className="h-4 w-4" /> Export
        </button>
      </header>

      {/* Canvas */}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3">
        <div className="checkerboard overflow-hidden rounded-2xl shadow-lg ring-1 ring-slate-200 dark:ring-slate-700">
          <canvas
            ref={displayRef}
            width={WORLD}
            height={WORLD}
            className="no-select block aspect-square w-[min(92vw,56dvh,480px)]"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        </div>
      </div>

      {/* Upload-Startbildschirm oder Werkzeuge */}
      {showUploadScreen ? (
        <div className="border-t border-slate-200 bg-white px-4 py-6 safe-bottom dark:border-slate-700 dark:bg-slate-900">
          <p className="mb-4 text-center text-sm text-slate-500 dark:text-slate-400">
            Wähle ein Foto aus – es bleibt auf deinem Gerät.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => galleryInput.current?.click()}
              className="flex flex-1 flex-col items-center gap-2 rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-500 py-5 font-bold text-white shadow-lg active:scale-95"
            >
              <ImagePlus className="h-7 w-7" /> Galerie
            </button>
            <button
              onClick={() => cameraInput.current?.click()}
              className="flex flex-1 flex-col items-center gap-2 rounded-3xl bg-gradient-to-br from-violet-400 to-purple-600 py-5 font-bold text-white shadow-lg active:scale-95"
            >
              <Camera className="h-7 w-7" /> Kamera
            </button>
          </div>
          {doc.mode !== 'profile' && (
            <button
              onClick={() => setTextModal({})}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 py-3 font-semibold text-slate-500 active:scale-95 dark:border-slate-600 dark:text-slate-400"
            >
              <TypeIcon className="h-5 w-5" /> Nur mit Text starten
            </button>
          )}
        </div>
      ) : (
        <EditorPanels
          doc={doc}
          setDoc={setDoc}
          tab={tab}
          setTab={setTab}
          tool={tool}
          setTool={setTool}
          brushSize={brushSize}
          setBrushSize={setBrushSize}
          tolerance={tolerance}
          setTolerance={setTolerance}
          selectedLayer={selectedLayer}
          updateLayer={updateLayer}
          removeLayer={removeLayer}
          addText={() => setTextModal({})}
          editText={(id) => setTextModal({ layerId: id })}
          addEmoji={addEmoji}
          hasImage={hasImage}
          onAutoRemove={onAutoRemove}
          onResetImage={onResetImage}
          onReplaceImage={() => galleryInput.current?.click()}
          rotate={rotate}
          flip={flip}
          fitImage={fitImage}
          drawColor={drawColor}
          setDrawColor={setDrawColor}
          drawSize={drawSize}
          setDrawSize={setDrawSize}
          onClearDrawing={clearDrawing}
          onApplyFilter={onApplyFilter}
        />
      )}

      {/* Versteckte Datei-Eingaben (Galerie & Kamera) */}
      <input
        ref={galleryInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void pickImage(f);
          e.target.value = '';
        }}
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void pickImage(f);
          e.target.value = '';
        }}
      />

      {/* Lade-Overlay */}
      {busy && (
        <div className="fixed inset-0 z-[95] flex flex-col items-center justify-center gap-3 bg-black/60 text-white">
          <Loader2 className="h-10 w-10 animate-spin" />
          <span className="font-semibold">{busy}</span>
        </div>
      )}

      {/* Dialoge */}
      <InputModal
        open={textModal !== null}
        title={textModal?.layerId ? 'Text bearbeiten' : 'Text hinzufügen'}
        initial={textModal?.layerId ? doc.layers.find((l) => l.id === textModal.layerId)?.text : ''}
        placeholder="Dein Text …"
        multiline
        onSubmit={(text) => {
          if (textModal?.layerId) updateLayer(textModal.layerId, { text });
          else addTextLayer(text);
        }}
        onClose={() => setTextModal(null)}
      />

      <Modal
        open={confirmBack}
        title="Editor verlassen?"
        confirmLabel="Verlassen"
        danger
        onConfirm={() => navigate('/')}
        onClose={() => setConfirmBack(false)}
      >
        Nicht gespeicherte Änderungen gehen verloren. Tippe vorher auf das Speichern-Symbol, um das Projekt zu
        behalten.
      </Modal>

      <ExportSheet
        open={showExport}
        onClose={() => setShowExport(false)}
        doc={doc}
        image={hasImage ? (filteredRef.current ?? imageRef.current) : null}
        drawing={drawingRef.current}
      />
    </div>
  );
}
