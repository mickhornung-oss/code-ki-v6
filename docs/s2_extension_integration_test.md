# S2 Integrationsnachweis: VS-Code Apply-Flow

## Ziel

Reproduzierbare Integrationspruefung des Apply-Flows im echten VS-Code-Extension-Host.

Abgedeckt:

- Confirm-Abbruch schreibt nichts
- bestaetigter Apply schreibt in die aktive Datei
- Konfliktfall wird blockiert

## Technischer Weg (S2)

Der Integrationsnachweis laeuft als Selftest-Command direkt in der Extension:

- Command: `Code KI V4: Apply-Flow Selftest (S2)`
- Implementierung: `vscode-extension/extension.js` (`runApplyFlowSelfTest`)
- Report: `logs/apply_flow_selftest_report.json`

Der Selftest oeffnet im Host eine echte temporaere Testdatei und fuehrt die Apply-Pfade kontrolliert aus.

## Ausfuehrung (S2.1 final)

1. Backend starten:

```powershell
powershell -File .\scripts\start_backend.ps1
```

2. Extension Development Host starten:

```powershell
powershell -File .\scripts\open_extension_dev.ps1
```

3. Im Dev Host Command Palette oeffnen (`Strg+Shift+P`) und ausfuehren:

- `Code KI V4: Apply-Flow Selftest (S2)`

4. Warten, bis die Meldung zum Selftest erscheint und der Report geschrieben wurde.

5. Report maschinell verifizieren:

```powershell
cd .\vscode-extension
npm run test:integration
```

Oder vom Repo-Root:

```powershell
powershell -File .\scripts\test_extension_integration.ps1
```

## Soll-Ergebnis

- `logs/apply_flow_selftest_report.json` existiert
- Der Report enthaelt die Szenarien:
  - `confirm_cancel`
  - `confirm_apply`
  - `conflict_blocked`
- Alle drei Szenarien stehen auf `passed: true`
- `powershell -File .\scripts\test_extension_integration.ps1` endet erfolgreich

## Was ist automatisiert?

- Ausfuehrung der drei Apply-Szenarien in echter Extension-Host-Session
- File-State-Pruefung je Szenario
- Persistenter JSON-Report
- CLI-Validierung des Reports (`npm run test:integration`)

## Minimal manuell

- Ein manueller Trigger im Dev Host (ein Command-Aufruf)

Grund: In der lokalen VS-Code-CLI-Variante ist ein voll-headless `--extensionTestsPath`-Lauf nicht stabil verfuegbar.
Der S2-Selftest minimiert den manuellen Rest auf genau diesen einen Host-Trigger.
