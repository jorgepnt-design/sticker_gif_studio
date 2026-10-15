/**
 * Eine PDF-Seite mit Ebene für platzierte Elemente und echte Eingabefelder
 * über den Formularfeldern des PDFs.
 */
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { AnnotationMode, type PdfJsDoc } from '../../lib/pdf';
import { LINE_HEIGHT, SYMBOL_PATHS, TEXT_FONT, type FormValues, type Item } from './model';

/** Formularfeld, wie pdf.js es liefert (nur die Eigenschaften, die wir nutzen) */
interface Widget {
  id: string;
  fieldName: string;
  fieldType: 'Tx' | 'Btn' | 'Ch';
  rect: [number, number, number, number]; // relativ: links, oben, rechts, unten
  checkBox?: boolean;
  radioButton?: boolean;
  buttonValue?: string;
  multiLine?: boolean;
  combo?: boolean;
  readOnly?: boolean;
  options?: { exportValue: string; displayValue: string }[];
  initial: string | boolean;
}

export interface PlaceInfo {
  page: number;
  u: number;
  v: number;
  widthPt: number;
  heightPt: number;
}

interface Props {
  doc: PdfJsDoc;
  pageIndex: number;
  width: number;
  items: Item[];
  selectedId: string | null;
  placing: boolean;
  formValues: FormValues;
  onFormChange: (name: string, value: string | boolean) => void;
  onPlace: (info: PlaceInfo) => void;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, patch: Partial<Item>) => void;
  onEditText: (id: string) => void;
}

type Drag = {
  id: string;
  mode: 'move' | 'resize';
  startX: number;
  startY: number;
  item: Item;
  moved: boolean;
  wasSelected: boolean;
};

export function PageView(props: Props) {
  const { doc, pageIndex, width, items, selectedId, placing, formValues } = props;
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null); // Seitengröße in pt (gedreht)
  const [visible, setVisible] = useState(false);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const drag = useRef<Drag | null>(null);

  // Seitengröße und Formularfelder einmalig laden
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const page = await doc.getPage(pageIndex + 1);
      const vp = page.getViewport({ scale: 1 });
      const annotations = await page.getAnnotations({ intent: 'display' });
      if (cancelled) return;
      setSize({ w: vp.width, h: vp.height });
      const list: Widget[] = [];
      for (const a of annotations) {
        if (a.subtype !== 'Widget' || !a.fieldName || a.hidden || !['Tx', 'Btn', 'Ch'].includes(a.fieldType)) continue;
        if (a.fieldType === 'Btn' && !a.checkBox && !a.radioButton) continue; // Schaltflächen ohne Wert
        const [x1, y1, x2, y2] = vp.convertToViewportRectangle(a.rect);
        const rect: Widget['rect'] = [
          Math.min(x1, x2) / vp.width,
          Math.min(y1, y2) / vp.height,
          Math.max(x1, x2) / vp.width,
          Math.max(y1, y2) / vp.height,
        ];
        let initial: string | boolean;
        if (a.checkBox) initial = !!a.fieldValue && a.fieldValue !== 'Off';
        else if (a.radioButton) initial = a.fieldValue && a.fieldValue !== 'Off' ? String(a.fieldValue) : '';
        else if (Array.isArray(a.fieldValue)) initial = String(a.fieldValue[0] ?? '');
        else initial = String(a.fieldValue ?? '');
        // Auswahllisten zeigen (und pdf-lib erwartet) den Anzeigewert, pdf.js liefert evtl. den Exportwert
        const match = a.options?.find((o: { exportValue: string }) => o.exportValue === initial);
        if (match) initial = match.displayValue;
        list.push({
          id: a.id,
          fieldName: a.fieldName,
          fieldType: a.fieldType,
          rect,
          checkBox: a.checkBox,
          radioButton: a.radioButton,
          buttonValue: a.buttonValue,
          multiLine: a.multiLine,
          combo: a.combo,
          readOnly: a.readOnly,
          options: a.options,
          initial,
        });
      }
      setWidgets(list);
      page.cleanup();
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [doc, pageIndex]);

  // Erst rendern, wenn die Seite in die Nähe des sichtbaren Bereichs kommt.
  // Der Container existiert erst, sobald die Seitengröße bekannt ist.
  const hasSize = size !== null;
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: '800px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasSize]);

  useEffect(() => {
    if (!visible || !size || !canvasRef.current) return;
    let task: { cancel: () => void } | null = null;
    let cancelled = false;
    (async () => {
      const page = await doc.getPage(pageIndex + 1);
      if (cancelled) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: (width / size.w) * dpr });
      const canvas = canvasRef.current!;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      // ENABLE_FORMS: Formularfelder nicht ins Bild malen – wir legen echte Eingabefelder darüber
      const render = page.render({
        canvasContext: canvas.getContext('2d')!,
        viewport,
        annotationMode: AnnotationMode.ENABLE_FORMS,
      });
      task = render;
      await render.promise;
    })().catch(() => {});
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [visible, size, width, doc, pageIndex]);

  if (!size) return <div className="mx-auto rounded bg-white shadow" style={{ width, height: width * 1.414 }} />;

  const height = (width * size.h) / size.w;
  const pxPerPt = width / size.w;

  const placeAt = (e: ReactMouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const u = (e.clientX - rect.left) / rect.width;
    const v = (e.clientY - rect.top) / rect.height;
    if (placing) props.onPlace({ page: pageIndex, u, v, widthPt: size.w, heightPt: size.h });
    else props.onSelect(null);
  };

  const startDrag = (e: ReactPointerEvent, item: Item, mode: Drag['mode']) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      id: item.id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      item,
      moved: false,
      wasSelected: item.id === selectedId,
    };
    props.onSelect(item.id);
  };

  const onDragMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    const du = dx / width;
    const dv = dy / height;
    if (d.mode === 'move') {
      props.onUpdate(d.id, { x: d.item.x + du, y: d.item.y + dv });
    } else if (d.item.kind === 'highlight') {
      props.onUpdate(d.id, { w: Math.max(0.02, d.item.w + du), h: Math.max(0.006, d.item.h + dv) });
    } else {
      // Seitenverhältnis beibehalten
      const w = Math.max(0.02, d.item.w + du);
      props.onUpdate(d.id, { w, h: (w * d.item.h) / d.item.w });
    }
  };

  const endDrag = () => {
    const d = drag.current;
    drag.current = null;
    // Zweites Antippen eines Textes öffnet die Bearbeitung
    if (d && !d.moved && d.wasSelected && d.item.kind === 'text') props.onEditText(d.id);
  };

  return (
    <div
      ref={boxRef}
      className={`no-select relative mx-auto bg-white shadow-md ${placing ? 'cursor-crosshair' : ''}`}
      style={{ width, height, touchAction: 'pan-x pan-y pinch-zoom' }}
      onClick={placeAt}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {widgets.map((w) => (
        <WidgetInput
          key={w.id}
          widget={w}
          width={width}
          height={height}
          value={formValues[w.fieldName] ?? w.initial}
          onChange={(v) => props.onFormChange(w.fieldName, v)}
        />
      ))}

      {items.map((item) => {
        const selected = item.id === selectedId;
        const common = {
          onPointerDown: (e: ReactPointerEvent) => startDrag(e, item, 'move'),
          onPointerMove: onDragMove,
          onPointerUp: endDrag,
          onPointerCancel: endDrag,
          onClick: (e: ReactMouseEvent) => e.stopPropagation(),
        };
        const outline = selected ? 'outline-2 outline-dashed outline-rose-500 outline-offset-2' : '';
        const left = item.x * width;
        const top = item.y * height;

        if (item.kind === 'text') {
          const fontPx = (item.fontSize ?? 12) * pxPerPt;
          return (
            <div
              key={item.id}
              {...common}
              className={`absolute cursor-move whitespace-pre ${outline}`}
              style={{
                left,
                top,
                fontFamily: TEXT_FONT,
                fontSize: fontPx,
                lineHeight: LINE_HEIGHT,
                color: item.color,
                touchAction: 'none',
                minWidth: fontPx,
                minHeight: fontPx * LINE_HEIGHT,
              }}
            >
              {item.text}
            </div>
          );
        }

        const w = item.w * width;
        const h = item.h * height;
        return (
          <div
            key={item.id}
            {...common}
            className={`absolute cursor-move ${outline}`}
            style={{ left, top, width: w, height: h, touchAction: 'none' }}
          >
            {item.kind === 'highlight' ? (
              <div className="h-full w-full mix-blend-multiply" style={{ background: item.color, opacity: 0.45 }} />
            ) : item.kind === 'signature' || item.kind === 'initials' ? (
              <img src={item.image} alt="" draggable={false} className="pointer-events-none h-full w-full" />
            ) : (
              <svg viewBox="0 0 100 100" className="pointer-events-none h-full w-full overflow-visible">
                <path
                  d={SYMBOL_PATHS[item.kind]}
                  fill={item.kind === 'dot' ? item.color : 'none'}
                  stroke={item.kind === 'dot' ? 'none' : item.color}
                  strokeWidth={12}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            {selected && (
              <span
                onPointerDown={(e) => startDrag(e, item, 'resize')}
                onPointerMove={onDragMove}
                onPointerUp={endDrag}
                className="absolute -bottom-3 -right-3 h-6 w-6 cursor-nwse-resize rounded-full border-2 border-white bg-rose-500 shadow"
                style={{ touchAction: 'none' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function WidgetInput({
  widget,
  width,
  height,
  value,
  onChange,
}: {
  widget: Widget;
  width: number;
  height: number;
  value: string | boolean;
  onChange: (v: string | boolean) => void;
}) {
  const [l, t, r, b] = widget.rect;
  const style = {
    left: l * width,
    top: t * height,
    width: (r - l) * width,
    height: (b - t) * height,
  };
  const fontSize = Math.max(8, Math.min(style.height * 0.65, 16));
  const base =
    'absolute border border-sky-400/60 bg-sky-100/40 text-slate-900 outline-none focus:border-sky-500 focus:bg-sky-100/70';
  const stop = { onClick: (e: ReactMouseEvent) => e.stopPropagation() };

  if (widget.checkBox || widget.radioButton) {
    const checked = widget.checkBox ? !!value : value === widget.buttonValue;
    return (
      <button
        disabled={widget.readOnly}
        onClick={(e) => {
          e.stopPropagation();
          if (widget.checkBox) onChange(!checked);
          else onChange(checked ? '' : widget.buttonValue ?? '');
        }}
        className={`${base} flex items-center justify-center ${widget.radioButton ? 'rounded-full' : ''}`}
        style={style}
        aria-label={widget.fieldName}
      >
        {checked && (
          <svg viewBox="0 0 100 100" className="h-4/5 w-4/5">
            {widget.radioButton ? (
              <circle cx="50" cy="50" r="28" fill="#111827" />
            ) : (
              <path d={SYMBOL_PATHS.check} fill="none" stroke="#111827" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
        )}
      </button>
    );
  }

  if (widget.fieldType === 'Ch') {
    return (
      <select
        {...stop}
        disabled={widget.readOnly}
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        className={base}
        style={{ ...style, fontSize }}
      >
        <option value="" />
        {widget.options?.map((o) => (
          <option key={o.exportValue} value={o.displayValue}>
            {o.displayValue}
          </option>
        ))}
      </select>
    );
  }

  const Tag = widget.multiLine ? 'textarea' : 'input';
  return (
    <Tag
      {...stop}
      readOnly={widget.readOnly}
      value={String(value)}
      onChange={(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value)}
      className={`${base} resize-none px-0.5`}
      style={{ ...style, fontSize, fontFamily: TEXT_FONT }}
      aria-label={widget.fieldName}
    />
  );
}
