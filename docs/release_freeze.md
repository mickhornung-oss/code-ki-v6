# Release- und Freeze-Stand (V6)

Stand: 2026-04-08

## Produktprofil

- Hauptproduktpfad: Sidebar im selben VS-Code-Fenster (`Code KI V6: Seitenleiste oeffnen`)
- Standardmodus: `V6 Produkt (Standard)`
- Zusatzmodus: `Projektagent (autonom nach Freigabe)` mit Projektordner-Guardrails
- Legacy/Debug: `Code KI V6: Legacy-Panel oeffnen`

## Release-Nachweise

- Repo-Smoke: `powershell -File .\scripts\test_v6_repo.ps1`
- Produktagent-Smoke: `powershell -File .\scripts\test_product_agent_repo.ps1`
- V5-Isolations-Smoke: `powershell -File .\scripts\test_v5_full_flow.ps1`
- Extension-Tests: `npm test` (im Ordner `vscode-extension`)
- Packaging: `npm run package` (im Ordner `vscode-extension`)

## Finaler manueller Check

- Ablauf siehe: `docs/manual_sidebar_acceptance.md`
- Fokus: Produktmodus, Projektagentenmodus, Status/Ergebnisdarstellung, Guardrail-Blocker

## Funktionsfreeze

- Dieser Stand ist als Release-/Abgabestand markiert.
- Nach diesem Block keine weiteren Funktionsaenderungen.
- Zulaessig sind nur:
  - dokumentierte Release-Bugfixes mit klarem Blockerbezug
  - Packaging-/Distributionskorrekturen ohne Featureumfang
