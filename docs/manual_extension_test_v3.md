# Manueller V3-Test der VS-Code-Erweiterung (Legacy)

Hinweis: Diese Datei dokumentiert den historischen V3-Klicklauf.
Der aktuelle Pflichtpfad fuer den Projektstand ist V4:
- [manual_extension_test.md](/c:/Users/mickh/Desktop/Code%20KI/docs/manual_extension_test.md)
- [manual_extension_test_v4.md](/c:/Users/mickh/Desktop/Code%20KI/docs/manual_extension_test_v4.md)

## Zweck

Dieser Ablauf bereitet die reale manuelle Praxisabnahme von V3 vor.
Der Klicklauf wird vom Benutzer im echten VS-Code-Extension-Development-Host ausgefuehrt.
Diese Datei beschreibt nur den Sollpfad und die zu dokumentierenden Fehlerfaelle.

Hinweis S2:
Der technische Apply-Flow (Confirm-Abbruch, Confirm-Apply, Konfliktfall) ist zusaetzlich automatisiert ueber
`scripts/test_extension_integration.ps1` bzw. `vscode-extension/integration/...` abgesichert.

## Startpfad

1. Backend starten:
   - `powershell -File .\scripts\start_backend.ps1`
2. Backend-Status pruefen:
   - `powershell -File .\scripts\status_backend.ps1`
3. Extension Development Host starten:
   - `powershell -File .\scripts\open_extension_dev.ps1`
4. Im Dev Host die Command Palette oeffnen und `Code KI V3: Assistent oeffnen` ausfuehren.

Soll vor dem Klicklauf:
- Das Backend ist unter `http://127.0.0.1:8787/health` erreichbar.
- `scripts/status_backend.ps1` zeigt `status`, `service`, `host`, `port`, `model_available`, `model_loaded` und `model_path`.
- Im Dev Host ist die Extension sichtbar und der Assistent oeffnet sich als `Code KI V3`.
- Das richtige Dev-Host-Fenster nutzt das isolierte Profil `logs\vscode-dev-host-profile`.
- Die produktive Webview zeigt den Debug-Hinweis `Build: V3 | Entry Point: extension.js`.

## Pflichtlauf fuer die V3-Abnahme

### 1. Assistent im Dev Host oeffnen

Aktion:
- Command Palette oeffnen
- `Code KI V3: Assistent oeffnen` ausfuehren

Soll:
- Ein Panel `Code KI V3` oeffnet sich
- Status steht auf `Bereit.`
- Sichtbar sind Modus, Arbeitsauftrag, Traceback-Feld und Ausfuehren-Button

### 2. Aktive Python-Datei laden

Aktion:
- Eine echte `.py`-Datei im Dev Host oeffnen
- Im Assistenten einen kurzen Arbeitsauftrag eingeben
- `Ausfuehren` klicken

Soll:
- Der Lauf startet ohne UI-Haenger
- Im Kontext steht der Pfad der aktiven Datei
- Status endet auf `Antwort empfangen.` oder es erscheint eine ehrliche Fehlermeldung

### 3. V3-Änderung mit mehreren Stellen erzeugen

Aktion:
- Einen Auftrag verwenden, der mehrere kleine, zusammenhaengende Aenderungen erwartet
- `Ausfuehren` klicken

Soll:
- Zusammenfassung wird befuellt
- Falls strukturiert erkannt: Erklaerung, Aenderungen und Risiken werden getrennt angezeigt
- Mehr als eine Aenderung kann in der Liste erscheinen
- Jede Aenderung hat Typ, Beschreibung, Zeilennummern und neuen Code
- Der Button `Aenderungen uebernehmen` ist nur aktiv, wenn echte Aenderungen vorliegen

### 4. V3-Änderungen anzeigen

Soll:
- Mehrere Aenderungen werden sauber angezeigt
- Zeilennummern (line_start, line_end) erscheinen sinnvoll
- Dateipfade (file_path) erscheinen, falls angegeben
- Jede Aenderung ist klar beschrieben und nachvollziehbar

### 5. V3-Prüfschritt starten

Aktion:
- Auf `Pruefschritt ausfuehren` klicken

Soll:
- Pruefschritt wird gestartet
- Ergebnis wird nach Abschluss angezeigt

### 6. V3-Ergebnisbewertung pruefen

Soll:
- Pruefschritt-Ergebnis wird angezeigt mit:
  - Status (erfolgreich, fehlgeschlagen, Warnung, blockiert)
  - Nachricht
  - Optional: stdout und stderr
- Die Bewertung ist knapp, technisch und verstaendlich

### 7. V3-Änderungen kontrolliert anwenden

Aktion:
- Auf `Aenderungen uebernehmen` klicken
- Im Bestaetigungsdialog erst abbrechen
- Danach erneut klicken und bestaetigen

Soll:
- Beim ersten Versuch bleibt die Datei unveraendert
- Beim bestaetigten Versuch werden die Aenderungen nur auf die aktive Datei angewendet
- Es erscheint eine Erfolgsinfo mit Hinweis auf `Strg+Z`

### 8. Fehlerfall testen

Aktion:
- Backend stoppen und erneut `Ausfuehren`
- Oder eine Antwort mit nicht mehr passendem `old_code` anwenden
- Oder ohne aktive Datei `Aenderungen uebernehmen`
- Oder einen Pruefschritt mit fehlerhaftem Code ausfuehren

Soll:
- Backend-Fehler wird klar als `backend_unreachable` oder `backend_error` sichtbar
- Ohne aktive Datei erscheint eine klare Fehlermeldung
- Nicht anwendbare Einzel-Aenderungen erzeugen Warnungen statt still zu scheitern
- Pruefschritt mit Fehler wird mit Status `failed` oder `blocked` angezeigt

## Zusatzpruefungen

- Leerer Prompt:
  Soll: `Bitte zuerst einen Arbeitsauftrag eingeben.`
- Keine aktive Datei beim Lauf:
  Soll: Kontext zeigt `keine aktive Datei`, der Lauf bleibt aber moeglich
- Zusatzdateien:
  Soll: Die aktuelle V3-UI bietet keinen Button fuer Zusatzdateien. `additional_files` wird nur auf API-Ebene unterstuetzt.

## Fehlerdokumentation waehrend des Klicklaufs

Bei Problemen immer festhalten:
- Testschritt
- Erwartetes Soll-Ergebnis
- Tatsachliches Ist-Verhalten
- Exakte Fehlermeldung
- Ob der Fehler im Backend-Terminal, in einer VS-Code-Meldung oder im Assistenten-Panel erschien
