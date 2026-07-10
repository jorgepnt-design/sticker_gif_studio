/** Untere Werkzeugleiste des Editors mit den einzelnen Panels */
import {
  Image as ImageIcon,
  Scissors,
  Type,
  Smile,
  Square,
  PaintBucket,
  RotateCcw,
  RotateCw,
  FlipHorizontal2,
  FlipVertical2,
  Maximize,
  Replace,
  Wand2,
  Eraser,
  Undo2,
  Trash2,
  Pencil,
  Plus,
  Sparkles,
  Brush,
} from 'lucide-react';
import type { EditorDoc, TextLayer } from '../../lib/types';
import { FONTS, EMOJI_SET } from '../../lib/templates';
import { NEUTRAL_ADJUST, type FilterPreset } from '../../lib/imaging';

export type Tab = 'image' | 'cutout' | 'filter' | 'draw' | 'text' | 'emoji' | 'border' | 'bg';

export const COLORS = [
  '#ffffff', '#111827', '#ef4444', '#f97316', '#facc15',
  '#22c55e', '#10b981', '#0ea5e9', '#3b82f6', '#8b5cf6', '#ec4899',
];

export interface PanelProps {
  doc: EditorDoc;
  setDoc: (updater: (d: EditorDoc) => EditorDoc) => void;
  tab: Tab;
  setTab: (t: Tab) => void;
  tool: 'move' | 'erase' | 'restore' | 'draw' | 'drawErase';
  setTool: (t: 'move' | 'erase' | 'restore' | 'draw' | 'drawErase') => void;
  brushSize: number;
  setBrushSize: (n: number) => void;
  tolerance: number;
  setTolerance: (n: number) => void;
  selectedLayer: TextLayer | null;
  updateLayer: (id: string, patch: Partial<TextLayer>) => void;
  removeLayer: (id: string) => void;
  addText: () => void;
  editText: (id: string) => void;
  addEmoji: (emoji: string) => void;
  hasImage: boolean;
  onAutoRemove: () => void;
  onResetImage: () => void;
  onReplaceImage: () => void;
  rotate: (dir: 1 | -1) => void;
  flip: (axis: 'x' | 'y') => void;
  fitImage: (cover: boolean) => void;
  drawColor: string;
  setDrawColor: (c: string) => void;
  drawSize: number;
  setDrawSize: (n: number) => void;
  onClearDrawing: () => void;
  onApplyFilter: (preset: FilterPreset) => void;
}

const TABS: { id: Tab; label: string; icon: typeof ImageIcon; needsImage?: boolean }[] = [
  { id: 'image', label: 'Bild', icon: ImageIcon, needsImage: true },
  { id: 'cutout', label: 'Freistellen', icon: Scissors, needsImage: true },
  { id: 'filter', label: 'Filter', icon: Sparkles, needsImage: true },
  { id: 'draw', label: 'Malen', icon: Brush },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'emoji', label: 'Emoji', icon: Smile },
  { id: 'border', label: 'Rand', icon: Square },
  { id: 'bg', label: 'Fläche', icon: PaintBucket },
];

const FILTER_PRESETS: { id: FilterPreset; label: string }[] = [
  { id: 'sw', label: 'S/W' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'invert', label: 'Invertiert' },
  { id: 'cartoon', label: 'Cartoon' },
  { id: 'comic', label: 'Comic' },
  { id: 'pixel', label: 'Pixel' },
  { id: 'blur', label: 'Unschärfe' },
  { id: 'sharpen', label: 'Schärfen' },
];

/** Kleine Hilfskomponenten */
function ToolButton({ label, icon: Icon, onClick, active }: { label: string; icon: typeof ImageIcon; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-2xl px-3 py-2.5 text-[11px] font-semibold active:scale-95 ${
        active
          ? 'bg-emerald-500 text-white'
          : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
      }`}
    >
      <Icon className="h-5 w-5" />
      {label}
    </button>
  );
}

function Swatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {COLORS.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={`h-8 w-8 rounded-full border-2 ${
            value === c ? 'border-emerald-500 ring-2 ring-emerald-300' : 'border-slate-200 dark:border-slate-600'
          }`}
          style={{ backgroundColor: c }}
          aria-label={`Farbe ${c}`}
        />
      ))}
      <label className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-full border-2 border-slate-200 bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)] dark:border-slate-600">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label="Eigene Farbe wählen"
        />
      </label>
    </div>
  );
}

function SliderRow({ label, min, max, value, onChange }: { label: string; min: number; max: number; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</label>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

export function EditorPanels(p: PanelProps) {
  const layer = p.selectedLayer;

  return (
    <div className="border-t border-slate-200 bg-white safe-bottom dark:border-slate-700 dark:bg-slate-900">
      {/* Aktives Panel */}
      <div className="max-h-56 overflow-y-auto px-4 py-3">
        {p.tab === 'image' && p.hasImage && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <ToolButton label="Links" icon={RotateCcw} onClick={() => p.rotate(-1)} />
              <ToolButton label="Rechts" icon={RotateCw} onClick={() => p.rotate(1)} />
              <ToolButton label="Spiegeln" icon={FlipHorizontal2} onClick={() => p.flip('x')} />
              <ToolButton label="Vertikal" icon={FlipVertical2} onClick={() => p.flip('y')} />
              <ToolButton label="Einpassen" icon={Maximize} onClick={() => p.fitImage(false)} />
              <ToolButton label="Füllen" icon={Square} onClick={() => p.fitImage(true)} />
              <ToolButton label="Ersetzen" icon={Replace} onClick={p.onReplaceImage} />
            </div>
            {p.doc.image && (
              <SliderRow
                label={`Größe: ${Math.round(p.doc.image.scale * 100)} % — zum Verschieben Bild mit dem Finger ziehen, mit zwei Fingern zoomen`}
                min={5}
                max={400}
                value={Math.round(p.doc.image.scale * 100)}
                onChange={(v) => p.setDoc((d) => (d.image ? { ...d, image: { ...d.image, scale: v / 100 } } : d))}
              />
            )}
          </div>
        )}

        {p.tab === 'cutout' && p.hasImage && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <ToolButton label="Automatisch" icon={Wand2} onClick={p.onAutoRemove} />
              <ToolButton label="Radierer" icon={Eraser} active={p.tool === 'erase'} onClick={() => p.setTool('erase')} />
              <ToolButton label="Zurückholen" icon={Undo2} active={p.tool === 'restore'} onClick={() => p.setTool('restore')} />
              <ToolButton label="Original" icon={RotateCcw} onClick={p.onResetImage} />
            </div>
            <SliderRow label={`Empfindlichkeit (Automatik): ${p.tolerance}`} min={5} max={90} value={p.tolerance} onChange={p.setTolerance} />
            <SliderRow label={`Pinselgröße: ${p.brushSize}`} min={6} max={80} value={p.brushSize} onChange={p.setBrushSize} />
            <p className="text-xs text-slate-400">
              „Automatisch“ entfernt einfarbige Hintergründe. Mit Radierer/Zurückholen direkt auf dem Bild malen.
            </p>
          </div>
        )}

        {p.tab === 'filter' && p.hasImage && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {FILTER_PRESETS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => p.onApplyFilter(f.id)}
                  className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600 active:scale-95 dark:bg-slate-700 dark:text-slate-300"
                >
                  {f.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400">Filter wirken auf das Bild und lassen sich über ↶ rückgängig machen.</p>
            <SliderRow
              label={`Helligkeit: ${p.doc.adjust.brightness} %`}
              min={20} max={200} value={p.doc.adjust.brightness}
              onChange={(v) => p.setDoc((d) => ({ ...d, adjust: { ...d.adjust, brightness: v } }))}
            />
            <SliderRow
              label={`Kontrast: ${p.doc.adjust.contrast} %`}
              min={20} max={200} value={p.doc.adjust.contrast}
              onChange={(v) => p.setDoc((d) => ({ ...d, adjust: { ...d.adjust, contrast: v } }))}
            />
            <SliderRow
              label={`Sättigung: ${p.doc.adjust.saturation} %`}
              min={0} max={200} value={p.doc.adjust.saturation}
              onChange={(v) => p.setDoc((d) => ({ ...d, adjust: { ...d.adjust, saturation: v } }))}
            />
            <SliderRow
              label={`Farbtemperatur: ${p.doc.adjust.temperature > 0 ? '+' : ''}${p.doc.adjust.temperature}`}
              min={-50} max={50} value={p.doc.adjust.temperature}
              onChange={(v) => p.setDoc((d) => ({ ...d, adjust: { ...d.adjust, temperature: v } }))}
            />
            <button
              onClick={() => p.setDoc((d) => ({ ...d, adjust: { ...NEUTRAL_ADJUST } }))}
              className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600 active:scale-95 dark:bg-slate-700 dark:text-slate-300"
            >
              Anpassungen zurücksetzen
            </button>
          </div>
        )}

        {p.tab === 'draw' && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <ToolButton label="Stift" icon={Brush} active={p.tool === 'draw'} onClick={() => p.setTool('draw')} />
              <ToolButton label="Radierer" icon={Eraser} active={p.tool === 'drawErase'} onClick={() => p.setTool('drawErase')} />
              <ToolButton label="Alles löschen" icon={Trash2} onClick={p.onClearDrawing} />
            </div>
            <SliderRow label={`Stiftgröße: ${p.drawSize}`} min={2} max={40} value={p.drawSize} onChange={p.setDrawSize} />
            <div>
              <span className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">Stiftfarbe</span>
              <Swatches value={p.drawColor} onChange={p.setDrawColor} />
            </div>
            <p className="text-xs text-slate-400">Zeichne direkt mit dem Finger auf die Fläche.</p>
          </div>
        )}

        {p.tab === 'text' && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <ToolButton label="Neuer Text" icon={Plus} onClick={p.addText} />
              {layer?.kind === 'text' && (
                <>
                  <ToolButton label="Bearbeiten" icon={Pencil} onClick={() => p.editText(layer.id)} />
                  <ToolButton label="Löschen" icon={Trash2} onClick={() => p.removeLayer(layer.id)} />
                </>
              )}
            </div>
            {layer?.kind === 'text' ? (
              <>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {FONTS.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => p.updateLayer(layer.id, { font: f.value })}
                      className={`shrink-0 rounded-xl border-2 px-3 py-1.5 text-sm ${
                        layer.font === f.value ? 'border-emerald-500 text-emerald-600' : 'border-slate-200 dark:border-slate-600'
                      }`}
                      style={{ fontFamily: f.value }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <SliderRow label={`Schriftgröße: ${Math.round(layer.size)}`} min={16} max={200} value={Math.round(layer.size)} onChange={(v) => p.updateLayer(layer.id, { size: v })} />
                <div>
                  <span className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">Textfarbe</span>
                  <Swatches value={layer.color} onChange={(c) => p.updateLayer(layer.id, { color: c })} />
                </div>
                <SliderRow label={`Kontur: ${layer.strokeWidth} %`} min={0} max={30} value={layer.strokeWidth} onChange={(v) => p.updateLayer(layer.id, { strokeWidth: v })} />
                {layer.strokeWidth > 0 && (
                  <div>
                    <span className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">Konturfarbe</span>
                    <Swatches value={layer.strokeColor} onChange={(c) => p.updateLayer(layer.id, { strokeColor: c })} />
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-400">
                Tippe „Neuer Text“ oder wähle einen Text auf der Fläche aus. Ziehen zum Verschieben, zwei Finger zum
                Skalieren und Drehen.
              </p>
            )}
          </div>
        )}

        {p.tab === 'emoji' && (
          <div className="space-y-3">
            {layer?.kind === 'emoji' && (
              <div className="flex flex-wrap items-center gap-2">
                <ToolButton label="Löschen" icon={Trash2} onClick={() => p.removeLayer(layer.id)} />
                <div className="min-w-40 flex-1">
                  <SliderRow label={`Größe: ${Math.round(layer.size)}`} min={24} max={300} value={Math.round(layer.size)} onChange={(v) => p.updateLayer(layer.id, { size: v })} />
                </div>
              </div>
            )}
            <div className="grid grid-cols-8 gap-1">
              {EMOJI_SET.map((e) => (
                <button key={e} onClick={() => p.addEmoji(e)} className="rounded-xl py-1 text-2xl active:scale-90 active:bg-slate-100 dark:active:bg-slate-700">
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}

        {p.tab === 'border' && (
          <div className="space-y-3">
            <label className="flex items-center justify-between">
              <span className="font-semibold">{p.doc.round ? 'Farbiger Ring' : 'Sticker-Rand'}</span>
              <input
                type="checkbox"
                checked={p.doc.border.enabled}
                onChange={(e) => p.setDoc((d) => ({ ...d, border: { ...d.border, enabled: e.target.checked } }))}
                className="h-6 w-6 accent-emerald-500"
              />
            </label>
            {p.doc.border.enabled && (
              <>
                <SliderRow label={`Stärke: ${p.doc.border.width}`} min={2} max={32} value={p.doc.border.width} onChange={(v) => p.setDoc((d) => ({ ...d, border: { ...d.border, width: v } }))} />
                <Swatches value={p.doc.border.color} onChange={(c) => p.setDoc((d) => ({ ...d, border: { ...d.border, color: c } }))} />
              </>
            )}
            <label className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-700">
              <span className="font-semibold">Schatten</span>
              <input
                type="checkbox"
                checked={p.doc.shadow.enabled}
                onChange={(e) => p.setDoc((d) => ({ ...d, shadow: { ...d.shadow, enabled: e.target.checked } }))}
                className="h-6 w-6 accent-emerald-500"
              />
            </label>
            {p.doc.shadow.enabled && (
              <>
                <SliderRow
                  label={`Weichheit: ${p.doc.shadow.blur}`}
                  min={0} max={30} value={p.doc.shadow.blur}
                  onChange={(v) => p.setDoc((d) => ({ ...d, shadow: { ...d.shadow, blur: v } }))}
                />
                <SliderRow
                  label={`Versatz: ${p.doc.shadow.offset}`}
                  min={0} max={24} value={p.doc.shadow.offset}
                  onChange={(v) => p.setDoc((d) => ({ ...d, shadow: { ...d.shadow, offset: v } }))}
                />
              </>
            )}
          </div>
        )}

        {p.tab === 'bg' && (
          <div className="space-y-3">
            <div>
              <span className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">Hintergrund</span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => p.setDoc((d) => ({ ...d, bg: null }))}
                  className={`checkerboard h-8 w-8 rounded-full border-2 ${
                    p.doc.bg === null ? 'border-emerald-500 ring-2 ring-emerald-300' : 'border-slate-200 dark:border-slate-600'
                  }`}
                  aria-label="Transparent"
                />
                <Swatches value={p.doc.bg ?? ''} onChange={(c) => p.setDoc((d) => ({ ...d, bg: c }))} />
              </div>
            </div>
            <label className="flex items-center justify-between">
              <span className="font-semibold">Rund zuschneiden</span>
              <input
                type="checkbox"
                checked={p.doc.round}
                onChange={(e) => p.setDoc((d) => ({ ...d, round: e.target.checked }))}
                className="h-6 w-6 accent-emerald-500"
              />
            </label>
          </div>
        )}
      </div>

      {/* Tab-Leiste (bei vielen Werkzeugen horizontal scrollbar) */}
      <div className="flex overflow-x-auto border-t border-slate-100 dark:border-slate-800">
        {TABS.filter((t) => !t.needsImage || p.hasImage).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => p.setTab(id)}
            className="flex min-w-[64px] flex-1 flex-col items-center gap-0.5 py-2"
          >
            <Icon className={`h-5 w-5 ${p.tab === id ? 'text-emerald-500' : 'text-slate-400'}`} />
            <span className={`whitespace-nowrap text-[10px] font-medium ${p.tab === id ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
