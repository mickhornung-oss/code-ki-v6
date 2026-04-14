# Code KI V4 Extension

Lokale VS-Code-Erweiterung fuer Code KI V4.

Produktiver Einstiegspunkt:
- `extension.js`

## Funktionen

- Prompt + Moduswahl inkl. `V4 Agent (kontrolliert)`
- Kontext aus aktiver Datei, Auswahl und begrenztem Workspace-Dateiindex
- strukturierte Antwortanzeige (Summary, Explanation, Changes, Risks)
- V4-Ablaufanzeige (Plan, Schrittstatus, Kontrollpunkte, Endstatus)
- kontrolliertes Apply mit Sicherheitsabfrage
- Pruefschritt-Ausfuehrung

## Sicherheitsverhalten

- keine stille Auto-Anwendung
- modaler Confirm vor Apply
- unsichere Aenderungen werden blockiert

## Tests

- Unit (Apply-Engine): `npm test`
- S2-Report-Validierung: `npm run test:integration`
