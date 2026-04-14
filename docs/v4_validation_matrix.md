# V4 Validierungsmatrix (Abschluss- und Belastungsblock)

## Automatisierte Abdeckung

- `tests/test_v4_workflow.py`
  - Planlogik
  - Dateivorschlaege
  - Kontrollpunktlogik
  - Abschlussstatus (`successful`, `partial`, `failed`, `blocked`)
- `tests/test_v4_scenarios.py`
  - Szenario A reine Analyse
  - Szenario B kleine sichere Aenderung
  - Szenario C mehrschrittiger Ablauf
  - Szenario D kontrollierte Blockierung
  - Szenario E teilweise erfolgreich
- `tests/test_service.py`
  - V4-Workflow-Ausgabe im `/assist`-Servicepfad
  - Blockierung ohne aktive Python-Datei
- `vscode-extension/tests/apply_engine.test.js`
  - deterministischer Apply-Pfad
  - Konflikt-/Mismatch-Blockierung

## Reproduzierbarer Repo-Smokepfad

```powershell
powershell -File .\scripts\test_v4_repo.ps1
```

Dieser Lauf prueft kombiniert:
- Python-V4-Tests (`test_v4_workflow`, `test_v4_scenarios`, `test_service`)
- Extension-Syntaxcheck (`node --check extension.js`)
- Extension-Tests (`npm test`)

## Minimaler manueller Rest

Manuell bleibt nur Host-/UI-Verhalten, das repo-seitig nicht voll headless abgesichert ist:
- V4-Webview-Darstellung im echten VS-Code-Dev-Host
- Nutzerinteraktion am Apply-Kontrollpunkt
- optionaler S2-Selftest-Trigger im Dev-Host

Manueller Lauf:
- `docs/manual_extension_test_v4.md`
