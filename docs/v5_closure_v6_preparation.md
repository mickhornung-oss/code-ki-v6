# V5 Abschluss und V6-Vorbereitung

## Zweck

Diese Datei schliesst V5 als isoliertes Testlabor ab und fasst zusammen, welche Erkenntnisse fuer V6 produktreif sind.

## V5 Gesamtpfad (abgeschlossen)

1. Auftrag annehmen (`agent_v5_lab`, Opt-in)
2. Alternativplaene erzeugen (A/B)
3. Plan explizit waehlen
4. Preview-Checkpoint
5. Dry-Run-Auswirkungen (Simulation)
6. Dry-Run-Diff-Skizze (Simulation, nicht anwendbar)
7. Praezisierungsschritt:
   - fester Typ (`none`, `narrow_focus`, `more_conservative`, `stricter_style`)
   - optionale kurze freie Praezisierung (max. 180 Zeichen)
8. Explizite Freigabe
9. Kontrollierte Uebergabe in den bestehenden sicheren Vorschlagspfad

## V5 Nutzensmatrix

| Baustein | Praktischer Nutzen | Reibung | Empfehlung fuer V6 |
|---|---|---|---|
| Mehrplanmodus | Erzwingt Alternativen statt Einwegantwort | Erhoeht UI-Schrittzahl | Als interne Planungsfunktion uebernehmen |
| Planwahl | Nutzerkontrolle, klare Entscheidung | Zusaetzlicher Klick | Uebernehmen, aber schlank darstellen |
| Preview | Fruehe Plausibilitaetspruefung | Gering | Uebernehmen |
| Dry-Run-Auswirkungen | Erwartete Dateien/Bereiche sichtbar | Mittel (zus. Schritt) | Optional in V6 (bei riskanteren Aufgaben) |
| Diff-Skizze | Erwartete Aenderungsrichtung transparent | Mittel bis hoch | Eher intern/optional, nicht immer sichtbar |
| Freie Kurzpraezisierung | Schnelle Feinsteuerung | Gering | Uebernehmen mit harter Begrenzung |
| Feste Praezisierungstypen | Reproduzierbare Steuerung | Gering | Uebernehmen (kleines Set) |

## Was bewusst Labor bleiben sollte

- Vollstaendige mehrstufige Sichtbarkeit jedes Zwischenzustands fuer jeden Standardlauf.
- Starke UI-Interaktion vor jeder Vorschlagsanforderung bei einfachen Aufgaben.
- Diff-Skizze als Pflichtschritt.

## V6-Vorbereitung (kein Ausbau in diesem Block)

### V6 Zielbild (minimal, produktnah)

- Nutzerfluss: Prompt rein -> Vorschlag raus.
- Interne Leitplanken bleiben aktiv (Planung, Risiko-/Kontextgrenzen, sichere Apply-/Test-Mechanik).
- Interne Mehrplan-/Praezisierungslogik nur dann sichtbar, wenn noetig (z. B. Unsicherheit oder hoeheres Risiko).

### Aus V5 in V6 uebernehmen

- Kontrollierte Planbasis (mindestens intern).
- Explizite Nutzerkontrolle bei kritischen Schritten.
- Kurze Praezisierung plus kleine feste Typen.
- Rollbackfaehige Sicherheitsgrenzen und klare Blocker-Meldungen.

### In V6 intern/optional halten

- Dry-Run-Auswirkungen als standardmaessig interner Schritt.
- Diff-Skizze nur bei komplexeren Faellen oder als "Mehr Details"-Pfad.

### Nicht in V6 uebernehmen

- Zwingende Vollkette mit allen V5-Checkpoints fuer jeden Run.
- Sichtbare Labor-Terminologie im Standardmodus.

## Nachweis / Abschlusschecks

- `powershell -File .\scripts\test_v5_full_flow.ps1`
- `powershell -File .\scripts\test_v5_lab.ps1`
- `powershell -File .\scripts\test_v4_repo.ps1`
