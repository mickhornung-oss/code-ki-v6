# Projektbeschreibung V4

## Ausgangslage

Das Projekt ist eine lokale Python-KI fuer VS Code. Nach V1.1/V2/V3 sowie Stabilisierung S1/S2 ist der Kern robust genug fuer einen kontrollierten Agentenmodus.

## Ziel in V4

V4 fuehrt eine erste agentische Ausbaustufe ein, ohne die Kontrolle abzugeben:
- strukturierter Plan
- gezielte Dateiauswahl
- schrittweiser Ablauf mit Status
- integrierte Kontrollpunkte
- klare Abschlussbewertung

## Reale V4-Funktionen

- Modus `agent_v4` im bestehenden `/assist`-Flow
- V4-Plan mit Schritten (`plan`, `file_selection`, `change_proposal`, `apply_checkpoint`, `test_step`, `evaluation`)
- Dateivorschlaege aus aktivem Kontext + Zusatzdateien + Workspace-Dateiindex
- Kontrollpunkt vor Apply (Nutzer bleibt Entscheider)
- finale Statusklassen: `successful`, `partial`, `failed`, `blocked`
- V4-Anzeige in der Extension (Plan, Schritte, Kontrollpunkte, Status)

## Tests und Nachweise

- Python-Testsuite inkl. V4-Workflow-Tests
- V4-Szenarioabdeckung A-E in `tests/test_v4_scenarios.py`
- Extension-Unittests (Apply-Engine)
- S2-Integrationspfad fuer Apply-Flow bleibt verfuegbar
- kombinierter V4-Repo-Smokepfad: `scripts/test_v4_repo.ps1`

## V4-Belastungsszenarien (A-E)

- A Reine Analyse: erfolgreicher V4-Lauf ohne Dateiaenderung
- B Kleine sichere Aenderung: kontrollierter Block am Apply-Kontrollpunkt
- C Mehrschrittablauf: Plan-/Schrittstruktur und Status sichtbar
- D Kontrollierte Blockierung: sauberer Block ohne aktive Python-Datei bzw. bei Nicht-Python-Datei
- E Teilerfolg: `partial`-Bewertung bei warnendem Pruefschritt

## Grenzen von V4

- kein vollautonomer Hintergrundagent
- keine Git-Automation
- keine unkontrollierte Multi-Datei-Grossumbauten
- kein Ollama

## Fazit

V4 ist ein kontrollierter Agentenmodus auf stabilem Fundament, nicht der Start eines freidrehenden Vollagenten.
V5 ist als separater Testlabor-Pfad vorbereitet und bewusst von der stabilen V4-Linie getrennt.

## V5-Testlabor (Abschlussstand)

Der V5-Laborpfad ist als kompletter Experimentflow verfuegbar und bewusst opt-in:
- Mehrplanmodus (A/B)
- Planwahl
- Preview
- Dry-Run-Auswirkungen
- Dry-Run-Diff-Skizze
- Praezisierung (fester Typ + optionaler Kurztext)
- erst danach kontrollierte Weitergabe in den sicheren Vorschlagspfad

Bewertung und V6-Vorbereitung:
- `docs/v5_closure_v6_preparation.md`

## V6 Minimal Product Flow

V6 ist der produktnahe Standardmodus (`agent_v6`) mit schlankem Hauptfluss:
- Prompt rein, strukturierter Vorschlag raus
- kompakte Statusdarstellung
- risikogesteuerte Zusatzsichtbarkeit statt permanenter Laborpflichtkette

V6 nutzt V5-Erkenntnisse intern (Alternativen, Praezisierungstypen, Leitplanken), ohne die sichtbare V5-Laborabfolge in den Standardmodus zu ziehen.

Siehe auch:
- `docs/v6_minimal_product_flow.md`

## Lokaler Projektagent (produktnah)

- eigener Modus `agent_project` mit expliziter Autonomie-Freigabe
- feste Projektordner-Grenze ueber `workspace_root`
- Eskalation nur bei echten externen Blockern oder out-of-scope Zugriffen
- normale Projektarbeit innerhalb des Projektordners ohne Dauer-Rueckfragen

## Single-Window-Integration

- Activity-Bar-Container und Sidebar-View sind die produktive Hauptansicht.
- `codeKIV3.openAssistant` fokussiert direkt den Sidebar-Pfad.
- Die Hauptoberflaeche in der Sidebar nutzt dieselbe Webview-Logik wie der fruehere Panel-Pfad.
- Das Panel bleibt nur als expliziter Legacy-/Debug-Befehl (`codeKIV3.openAssistantPanel`) vorhanden.
- Dev-Host bleibt fuer Entwicklung und Tests.

## Kompakter Endnutzer-Check

- Produktnaher Sidebar-Abnahmepfad:
  - `docs/manual_sidebar_acceptance.md`
- Ziel:
  - V6 und Projektagent im selben Fenster nutzbar
  - klare Status-/Risikodarstellung
  - keine Panel-Abhaengigkeit im Normalbetrieb

## Release und Freeze

- Packaging der Extension:
  - im Ordner `vscode-extension` -> `npm run package`
- Release-/Freeze-Dokument:
  - `docs/release_freeze.md`
