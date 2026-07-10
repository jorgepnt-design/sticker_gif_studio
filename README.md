# Sticker & GIF Studio *by Jorge* 🎨

Eine moderne Progressive Web App (PWA) zum Erstellen von **WhatsApp-Stickern, Memes und Profilbildern** – direkt im Browser, optimiert für iPhone und Android.

**Datenschutz zuerst:** Alle Bilder werden ausschließlich lokal auf dem Gerät verarbeitet. Kein Upload, kein Konto, kein Tracking.

## ✨ Funktionen (Phase 1–3)

- **Sticker-Editor** mit Touch-Bedienung
  - Foto aus Galerie wählen oder mit der Kamera aufnehmen
  - Hintergrund **automatisch entfernen** (Flood-Fill mit einstellbarer Empfindlichkeit)
  - Hintergrund **manuell radieren** und wieder **zurückholen**
  - Bild verschieben, zoomen (Pinch), drehen, spiegeln
  - **Text** mit 6 Schriftarten, Farbe, Kontur; Ebenen frei verschieb-, skalier- und drehbar
  - **Emojis** als eigene Ebenen
  - **Sticker-Rand** (Silhouetten-Outline) in Farbe und Stärke einstellbar
  - Hintergrundfarbe oder Transparenz
  - Rückgängig / Wiederholen für Radierer-Aktionen
- **Export**: WebP oder PNG, 512 × 512 px, automatische Optimierung auf < 100 KB (WhatsApp-Limit), Teilen über die Web Share API oder Download
- **Meme-Generator**: Bild + Text oben/unten im klassischen Stil
- **Profilbild-Maker**: rund zuschneiden mit farbigem Ring
- **Bild-Komprimierer**: mehrere Bilder auf einmal verkleinern (JPG/WebP), mit Vorher/Nachher-Größe
- **12 bearbeitbare Vorlagen** (Guten Morgen, Danke, Geburtstag …)
- **Projekte**: lokal in IndexedDB gespeichert, nach Neustart wieder ladbar, umbenennen & löschen
- **GIF-Ersteller** (Phase 2)
  - Quellen: Video (mit Trimmen per Start/Ende-Regler und wählbarer Bildrate), GIF-Datei oder Bilderserie
  - Richtung vorwärts / rückwärts / **Ping-Pong**, Geschwindigkeit 25–300 %
  - Seitenverhältnisse 1:1, 9:16, 16:9, 4:5 oder frei; Größe und Farbanzahl einstellbar
  - Text-Overlay (per Finger positionierbar), optional Hintergrund entfernen
  - Kodierung im **Web Worker** (gifenc) mit Fortschrittsbalken und Abbrechen
- **Animierte Sticker** (Phase 2): gleicher Ablauf mit 512-px-Voreinstellung, Warnung über 500 KB und automatischer Optimierung (weniger Farben/Frames)
- **Sticker-Bibliothek** (Phase 2): Suche, Favoriten, Kategorien, zuletzt verwendet
- **Stickerpakete** (Phase 2): Name & Autor, Sortierung, Mindestanzahl-Prüfung (3), Export als **ZIP** (Sticker + pack.json) zum Teilen
- **GIF→Video-Konverter** (Phase 2): GIF als MP4/WebM speichern (MediaRecorder), Hintergrundfarbe, Auflösung, Wiederholungen
- **Erweiterte Effekte** (Phase 3)
  - Nicht-destruktive Anpassungen: Helligkeit, Kontrast, Sättigung, Farbtemperatur
  - Filter: Schwarz-Weiß, Sepia, Invertieren, Cartoon, Comic, Pixel, Unschärfe, Schärfen (Undo-fähig)
  - Schlagschatten mit Weichheit und Versatz
  - **Freihand-Zeichnen** mit Stift, Radierer, Farbe und Stiftgröße (wird im Projekt mitgespeichert)
  - **Vorher/Nachher**: Auge-Symbol gedrückt halten zeigt das Original
  - Export zusätzlich als **JPG** (mit weißem Hintergrund)
- **Sicherung & Übertragung** (Phase 3): alle Projekte, Sticker und Pakete als Datei exportieren und auf einem anderen Gerät wiederherstellen – die lokale Vorstufe zur optionalen Cloud-Synchronisierung
- **Heller & dunkler Modus**, untere Navigationsleiste, komplett responsive
- **PWA**: offline nutzbar, auf dem Home-Bildschirm installierbar

## 🚀 Installation & Start

Voraussetzung: [Node.js](https://nodejs.org) ab Version 18.

```bash
# 1. Repository klonen
git clone https://github.com/jorgepnt-design/sticker_gif_studio.git
cd sticker_gif_studio

# 2. Abhängigkeiten installieren
npm install

# 3. Entwicklungsserver starten
npm run dev
# → http://localhost:5173 im Browser öffnen

# Produktions-Build erstellen (Ausgabe in dist/)
npm run build

# Produktions-Build lokal testen
npm run preview
```

**Auf dem Smartphone testen:** `npm run dev -- --host` starten und die angezeigte Netzwerk-IP am Handy öffnen (gleiches WLAN).

## 📦 Verwendete Pakete

| Paket | Zweck |
|---|---|
| `react` / `react-dom` | UI-Framework |
| `typescript` | Typsicherheit |
| `vite` | Build-Tool & Dev-Server |
| `tailwindcss` + `@tailwindcss/vite` | Utility-CSS-Styling |
| `vite-plugin-pwa` | Service Worker, Manifest, Offline-Support |
| `lucide-react` | Icon-Set |
| `gifenc` | GIF-Kodierung (läuft im Web Worker) |
| `gifuct-js` | GIF-Dateien in Einzelframes zerlegen |
| `fflate` | ZIP-Erstellung für Stickerpakete |

Bewusst **ohne** schwere Editor-Bibliotheken: Der Canvas-Editor (Gesten, Ebenen, Compositing) ist mit der nativen Canvas- und Pointer-Events-API umgesetzt – das hält die App klein (~70 KB gzip) und schnell auf älteren Smartphones. Die Projektspeicherung nutzt IndexedDB direkt.

## 🗂️ Projektstruktur

```
src/
├── main.tsx              # Einstiegspunkt, Service-Worker-Registrierung
├── App.tsx               # Routing + Theme
├── index.css             # Tailwind, Farbschema, Basis-Styles
├── components/           # Wiederverwendbare UI (Toast, Modal, BottomNav)
├── pages/
│   ├── Home.tsx          # Startseite mit Funktionskarten
│   ├── Create.tsx        # Werkzeug-Übersicht
│   ├── Projects.tsx      # Projektverwaltung (IndexedDB)
│   ├── Templates.tsx     # Vorlagen-Galerie
│   ├── Settings.tsx      # Theme, Export-Standards, Datenschutz, Daten löschen
│   ├── Compress.tsx      # Bild-Komprimierer
│   ├── GifStudio.tsx     # GIF & animierte Sticker (Trimmen, Tempo, Text, Export)
│   ├── Gif2Mp4.tsx       # GIF→Video-Konverter (MediaRecorder)
│   ├── Library.tsx       # Sticker-Bibliothek (Suche, Favoriten, Kategorien)
│   ├── PackDetail.tsx    # Stickerpaket: sortieren, ZIP-Export
│   └── editor/
│       ├── Editor.tsx        # Editor-Kern: Canvas, Gesten, Ebenen, Undo
│       ├── EditorPanels.tsx  # Werkzeug-Panels (Bild, Freistellen, Text, …)
│       └── ExportSheet.tsx   # Export mit Format/Qualität/WhatsApp-Check
├── workers/
│   └── gif.worker.ts     # GIF-Kodierung im Hintergrund (gifenc)
└── lib/
    ├── imaging.ts        # Medienverarbeitung: Freistellen, Rand, Compositing, Export
    ├── gif.ts            # Frame-Extraktion (Video/GIF/Bilder), Sequenzen, Encoder-Anbindung
    ├── db.ts             # IndexedDB-Wrapper (Projekte, Bibliothek, Pakete)
    ├── share.ts          # Web Share API + Download-Fallback
    ├── templates.ts      # Vorlagen, Schriftarten, Emoji-Set
    ├── settings.ts       # Einstellungen (localStorage) + Theme
    ├── router.tsx        # Minimaler Hash-Router
    └── types.ts          # Zentrale Typdefinitionen
```

## 📲 Sticker in WhatsApp verwenden

1. Sticker im Editor erstellen und auf **Export → Teilen** tippen – auf dem Smartphone kann er direkt an einen WhatsApp-Chat gesendet werden.
2. Für ein echtes **Sticker-Paket**: exportierte WebP/PNG-Dateien in einer Sticker-Import-App (z. B. „Sticker Maker“) hinzufügen und das Paket zu WhatsApp exportieren.
3. Hinweis: Web-Apps dürfen Sticker technisch bedingt nicht direkt in WhatsApp installieren – das erlaubt WhatsApp nur nativen Apps. Der Export erfüllt aber alle Anforderungen (512 × 512 px, transparenter Hintergrund, < 100 KB).

## 🔒 Datenschutz

- Verarbeitung ausschließlich lokal im Browser (Canvas API)
- Keine Server, keine Uploads, keine Cookies, kein Tracking
- „Alle Daten löschen“ in den Einstellungen entfernt sämtliche lokalen Daten
- Datenschutzerklärung in der App unter Einstellungen → Datenschutz

## 🛣️ Roadmap

- **Phase 2 ✅** Stickerpakete (ZIP-Export), animierte Sticker, GIF-Ersteller, GIF→Video-Konverter, Sticker-Bibliothek
- **Phase 3 ✅** erweiterte Effekte (Anpassungen, Filter, Schatten, Zeichnen, Vorher/Nachher), JPG-Export, lokale Sicherung/Übertragung
- **Ausblick:** optionale Cloud-Synchronisierung mit Benutzerkonto (z. B. Supabase), native iOS/Android-App (z. B. via Capacitor) mit direktem WhatsApp-Sticker-Import
