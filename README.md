# Sticker & GIF Studio 🎨

Eine moderne Progressive Web App (PWA) zum Erstellen von **WhatsApp-Stickern, Memes und Profilbildern** – direkt im Browser, optimiert für iPhone und Android.

**Datenschutz zuerst:** Alle Bilder werden ausschließlich lokal auf dem Gerät verarbeitet. Kein Upload, kein Konto, kein Tracking.

## ✨ Funktionen (Phase 1)

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
- **Heller & dunkler Modus**, untere Navigationsleiste, komplett responsive
- **PWA**: offline nutzbar, auf dem Home-Bildschirm installierbar

Phase 2 (animierte Sticker, GIF-Erstellung, Stickerpakete) ist in der Oberfläche bereits als „Bald verfügbar“ angelegt.

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
│   └── editor/
│       ├── Editor.tsx        # Editor-Kern: Canvas, Gesten, Ebenen, Undo
│       ├── EditorPanels.tsx  # Werkzeug-Panels (Bild, Freistellen, Text, …)
│       └── ExportSheet.tsx   # Export mit Format/Qualität/WhatsApp-Check
└── lib/
    ├── imaging.ts        # Medienverarbeitung: Freistellen, Rand, Compositing, Export
    ├── db.ts             # IndexedDB-Wrapper (Projekte, Alles-löschen)
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

- **Phase 2:** Stickerpakete (ZIP-Export), animierte Sticker, GIF-Ersteller (FFmpeg.wasm), Video-Konverter, Sticker-Bibliothek
- **Phase 3:** erweiterte Effekte, Cloud-Sync (optional), native iOS/Android-App (z. B. via Capacitor)
