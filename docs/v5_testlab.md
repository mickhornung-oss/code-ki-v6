# V5 Testlabor (V5.7)

## Experimentziel V5.7

Erster isolierter Laborversuch mit expliziter Planwahl, Preview-Checkpoint, Dry-Run-Auswirkungen, Dry-Run-Diff-Skizze und kleinem Praezisierungsschritt mit festen Typen:
Mehrplan-/Alternativenmodus mit kontrollierter Uebergabe nur nach dreifacher Freigabe.

- V4 bleibt kontrollierter Einzelplan.
- V5.7 erzeugt mindestens zwei alternative Mini-Plaene fuer denselben Auftrag.
- Nutzer waehlt explizit genau einen Plan (A oder B).
- Nach der Wahl erscheint ein Preview-Checkpoint (Plan, Dateien, Risiko, naechste Aktion).
- Nach Preview-Freigabe erscheint ein Dry-Run-Checkpoint (Simulation) mit erwarteten Auswirkungen.
- Nach Dry-Run-Freigabe erscheint eine Dry-Run-Diff-Skizze (Simulation, nicht anwendbar).
- Nach Diff-Skizzen-Freigabe erscheint ein kleiner optionaler Praezisierungsschritt (max. 180 Zeichen) mit festen Typen:
  - Fokus enger
  - Konservativer
  - Stil strenger
- Nur nach expliziter Praezisierungs-Freigabe wird der gewaehlte Plan in den bestehenden sicheren Aenderungs-/Apply-Pfad uebergeben.
- Bei Abbruch endet der Pfad ohne Weitergabe.
- Keine automatische Ausfuehrung der Alternativen.
- Keine Aenderung am V4-Standardpfad.

## Leitplanken

- V5 darf V4 nicht still veraendern oder destabilisieren.
- V5-Aenderungen muessen klar als experimentell markiert sein.
- Keine Produktionsaussagen auf Basis von V5-Experimenten ohne separaten Nachweis.
- V5.7 ist nur per Opt-in aktiv.

## Aktivierung (Opt-in)

1. Marker aktivieren in `config/v5_lab_marker.json`:
   - `v5_lab.enabled` auf `true` setzen.
2. Backend starten.
3. In der Extension Modus `V5.7 Testlabor (Mehrplan+Wahl+Preview+DryRun+Diff+Praezisierung+Typen)` waehlen.
4. Auftrag ausfuehren.
5. Im V5-Panel explizit `Diesen Plan waehlen` bei Plan A oder Plan B klicken.
6. Preview-Checkpoint pruefen und dann:
   - `Preview freigeben`, oder
   - `Abbrechen`
7. Nach Preview-Freigabe den Dry-Run-Checkpoint pruefen und dann:
   - `Dry-Run freigeben`, oder
   - `Abbrechen`
8. Nach Dry-Run-Freigabe die Diff-Skizze pruefen und dann:
   - `Diff-Skizze freigeben`, oder
   - `Abbrechen`
9. Nach Diff-Skizzen-Freigabe festen Typ waehlen und optional kleine Praezisierung eingeben, dann:
   - `Praezisierung freigeben und weiter`, oder
   - `Abbrechen`

Soll:
- V5-Lab-Card mit mindestens zwei Alternativplaenen (Plan A / Plan B) sichtbar.
- Unterschiede in Strategie und Risiko klar erkennbar.
- Gewaehlter Plan wird sichtbar markiert.
- Preview zeigt Plan-ID/Name, erwartete Dateien, Profil und naechste Aktion.
- Dry-Run zeigt klar eine Simulation (Dateien, erwartete Bereiche, erwartete Aenderungsart, Risiko/Profil).
- Diff-Skizze zeigt pseudo-diffartige Hunk-Skizzen und ist klar als nicht anwendbare Simulation markiert.
- Praezisierungstyp ist als feste kleine Auswahl vorhanden und getrennt sichtbar.
- Freie Kurzpraezisierung bleibt optional, klein begrenzt und getrennt vom Ursprungsauftrag sichtbar.
- Ohne Praezisierungs-Freigabe keine kontrollierte Weiterverwendung.
- Mit Praezisierungs-Freigabe wird nur der gewaehlte Plan kontrolliert weiterverwendet.
- Keine automatische Ausfuehrung.

## Messkriterium V5.7

- Isolierter Pfad: nur bei Modus `agent_v5_lab` und Marker `enabled=true`.
- Mindestens zwei strukturierte, unterscheidbare Mini-Plaene.
- Explizite Planwahl A/B in der UI.
- Preview-Checkpoint mit expliziter Freigabe/Abbruch.
- Dry-Run-Checkpoint mit expliziter Freigabe/Abbruch.
- Diff-Skizzen-Checkpoint mit expliziter Freigabe/Abbruch.
- Praezisierungs-Checkpoint mit expliziter Freigabe/Abbruch (fester Typ + optionaler, begrenzter Input).
- Uebergabe nur des gewaehlten Plans und nur nach Praezisierungs-Freigabe.
- V4-Verhalten bleibt unveraendert.
- V5.7 ist klar als Testlabor erkennbar.

## Tests/Nachweis

- `python -m unittest tests.test_v5_lab tests.test_service -v`
- `powershell -File .\scripts\test_v5_lab.ps1`
- `cd .\vscode-extension; npm test` (enthaelt V5-Planwahl-Hilfstests und V5-Gesamtpfad-Smoke)
- `powershell -File .\scripts\test_v5_full_flow.ps1`
- Regression V4:
  - `powershell -File .\scripts\test_v4_repo.ps1`

## Nicht Teil dieses Geruests

- kein aktiver V5-Produktmodus in der Extension
- keine neue Agentenarchitektur
- keine V6-Themen

## Rollback / Entfernung

Sofort-Deaktivierung:
- `config/v5_lab_marker.json` -> `v5_lab.enabled = false`

Rueckbau:
- V5-Lab-Datei entfernen: `backend/v5_lab.py`
- V5-Schemafelder entfernen: `backend/schemas.py`
- V5-Branch in `backend/service.py` entfernen
- V5-UI-Card/Modusoption in `vscode-extension/extension.js` entfernen
- V5-Planwahl-Hilfsmodul entfernen: `vscode-extension/v5_plan_selection.js`
- V5-Tests entfernen: `tests/test_v5_lab.py`, `vscode-extension/tests/v5_plan_selection.test.js` und zugehoerige Service-Tests
