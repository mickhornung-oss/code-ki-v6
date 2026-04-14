# Manueller V4-Test der VS-Code-Erweiterung

## Startpfad

1. Backend starten:
   - `powershell -File .\scripts\start_backend.ps1`
2. Backend-Status pruefen:
   - `powershell -File .\scripts\status_backend.ps1`
3. Extension Development Host starten:
   - `powershell -File .\scripts\open_extension_dev.ps1`
4. Im Dev Host Command Palette:
   - `Code KI V4: Assistent oeffnen`

## Pflichtlauf

### 1. V4-Modus aktivieren

- Im Modusfeld `V4 Agent (kontrolliert)` waehlen.
- Prompt eingeben, z. B. kleine Python-Verbesserung auf geoeffneter Datei.

Soll:
- Lauf startet
- V4-Card wird sichtbar
- aktive Python-Datei wird automatisch uebernommen (ohne manuelle Dateiangabe im Prompt)

### 2. Szenario A - reine Analyse

Soll:
- Plan zeigt mehrere Schritte
- relevante Dateien sind nachvollziehbar
- finaler Status ist sichtbar
- keine unnötigen Zusatzdateien

### 3. Szenario B - kleine sichere Aenderung

Bei vorgeschlagenen Aenderungen:
- V4 zeigt Kontrollpunkt `Aenderungen anwenden`
- Button `Aenderungen uebernehmen` ist verfuegbar

### 4. Sicherheitsabfrage und Apply

- `Aenderungen uebernehmen`
- zuerst abbrechen, dann bestaetigen

Soll:
- Abbruch: keine Dateiänderung
- Bestaetigung: Aenderung wird angewendet

### 4. Szenario C - mehrschrittiger Ablauf

- Plan zeigt `plan -> file_selection -> change_proposal -> apply_checkpoint -> test_step -> evaluation`
- Schrittstatus ist nachvollziehbar (success/blocked/skipped)

### 5. Szenario D - kontrollierte Blockierung

- keine aktive Python-Datei oder aktive Nicht-Python-Datei

Soll:
- klarer Blocker-Hinweis
- keine Halluzinationsaenderungen

### 6. Szenario E - teilweise erfolgreich

- `Pruefschritt ausfuehren`

Soll:
- Ergebnis erscheint mit Status + Meldung
- bei Warnung wird V4-Status als `partial`/`blocked`/`failed` plausibel dargestellt

### 7. Abschlussstatus

Soll:
- V4-Status zeigt klare Endbewertung
- naechster Schritt ist sichtbar (wenn blockiert/teilweise)

## Fehlerfall

- Ungueltiger Auftrag oder nicht parsebare Modellantwort

Soll:
- Schritt `change_proposal` zeigt Fehler
- finaler Status ist `failed` oder `blocked`
- keine stille Dateiuebernahme

## S2-Bezug

Der separate Apply-Selftest bleibt verfuegbar:
- `Code KI V4: Apply-Flow Selftest (S2)`
- danach `powershell -File .\scripts\test_extension_integration.ps1`

## Repo-seitiger Schnellnachweis

Vor dem manuellen Lauf:
- `powershell -File .\scripts\test_v4_repo.ps1`
