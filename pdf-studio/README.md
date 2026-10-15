# PDF Studio *by Jorge* 📄

Eigenständige Progressive Web App mit den wichtigsten PDF-Werkzeugen – inspiriert vom Funktionsumfang von Acrobat Studio, aber eigenständig umgesetzt mit Open-Source-Bibliotheken ([pdf-lib](https://pdf-lib.js.org/) zum Bearbeiten, [pdf.js](https://mozilla.github.io/pdf.js/) zum Anzeigen).

**Datenschutz zuerst:** Alle Dateien werden ausschließlich lokal im Browser verarbeitet. Kein Upload, kein Konto, kein Tracking – nach dem ersten Laden auch offline nutzbar.

## Funktionen

### Ausfüllen & Unterschreiben
- **Formularfelder** (AcroForm) direkt auf der Seite ausfüllen: Textfelder, Kontrollkästchen, Optionsfelder, Auswahllisten
- **Text** frei platzieren (Größe, Farbe, mehrzeilig, Umlaute)
- **Datum** mit einem Tipp einfügen
- **Häkchen, Kreuz, Punkt** als Vektorsymbole
- **Unterschrift & Initialen** zeichnen oder tippen – werden nur auf dem Gerät gespeichert und lassen sich wiederverwenden
- **Markieren** (Textmarker in drei Farben)
- Elemente verschieben, skalieren, duplizieren, löschen (Entf-Taste am Desktop)
- Funktioniert auch auf **gedrehten Seiten** – Inhalte erscheinen aufrecht
- Optional: Formular **fixieren** (flach machen), damit Felder nicht mehr geändert werden können

### PDF-Werkzeuge
- **PDFs zusammenfügen** – beliebig viele Dateien, Reihenfolge per Hoch/Runter
- **Seiten organisieren** – Seitenvorschau, sortieren, drehen, löschen, ausgewählte Seiten **extrahieren**, mehrere PDFs seitenweise mischen
- **PDF aufteilen** – alle *n* Seiten eine neue Datei, als ZIP
- **PDF komprimieren** – verlustfrei (aufräumen, Objekt-Streams) oder in drei Stufen über Neuaufbau der Seiten als JPEG (ideal für Scans)
- **Bilder in PDF** – Fotos/Scans als Seiten, A4/Letter/Bildgröße, Ausrichtung, Rand; Handyfotos werden richtig gedreht (EXIF)
- **PDF in Bilder** – jede Seite als JPG oder PNG (72/150/300 DPI), mehrere Seiten als ZIP

Ergebnisse lassen sich speichern oder über das Teilen-Menü des Geräts (z. B. WhatsApp, Mail) weitergeben.

## Grenzen
- Passwortgeschützte PDFs werden nicht unterstützt (klare Fehlermeldung).
- Platzierter Text nutzt die PDF-Standardschrift Helvetica; Zeichen außerhalb von Westeuropäisch (z. B. Emojis) werden durch „?“ ersetzt.
- Die starken Komprimierungsstufen rastern die Seiten – Text ist danach nicht mehr markierbar.

## Entwicklung

```bash
cd pdf-studio
npm install
npm run dev      # Entwicklungsserver
npm run build    # Typprüfung + Produktions-Build nach dist/
npm run preview  # Build lokal ansehen
```

Die App nutzt eine relative Basis (`base: './'`) und läuft daher unter jedem Pfad, z. B. als eigene GitHub-Pages-Seite.

### Aufbau
| Pfad | Inhalt |
| --- | --- |
| `src/lib/pdf.ts` | pdf.js/pdf-lib laden, Seiten rendern, Hilfsfunktionen |
| `src/lib/assemble.ts` | Seiten aus mehreren Quellen zu einem neuen PDF zusammensetzen |
| `src/pages/fill-sign/model.ts` | Datenmodell und Einbrennen von Text/Symbolen/Unterschriften inkl. Koordinatenumrechnung für gedrehte Seiten |
| `src/pages/fill-sign/PageView.tsx` | Seite mit verschiebbaren Elementen und Formular-Eingabefeldern |
| `src/pages/fill-sign/SignaturePad.tsx` | Unterschrift zeichnen/tippen |
| `src/pages/*.tsx` | Die einzelnen Werkzeuge |
