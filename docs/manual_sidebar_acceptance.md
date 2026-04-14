# Manuelle Sidebar-Abnahme (Single-Window)

## Ziel

Produktnah pruefen, dass die Hauptoberflaeche im normalen VS-Code-Fenster ueber die Sidebar klar bedienbar ist.

## Finaler Release-Check (kompakt)

1. Backend starten:
   - `powershell -File .\scripts\start_backend.ps1`
2. Backend-Status:
   - `powershell -File .\scripts\status_backend.ps1`
3. Extension in VS Code laden (Dev-Host nur fuer Entwicklungstests).
4. Command Palette:
   - `Code KI V6: Seitenleiste oeffnen`
5. Activity-Bar `Code KI` -> View `Agent` nutzen.

## Pflichtpruefung (Release)

1. `V6 Produkt (Standard)`:
   - kurzer Auftrag
   - Ergebnis-/Statusdarstellung pruefen
   - optional `Pruefschritt ausfuehren`
2. `Projektagent (autonom nach Freigabe)`:
   - Checkbox `Autonomie-Freigabe` aktivieren
   - kleiner Auftrag im Projektordner
   - Agentenstatus + Guardrail-Verhalten pruefen
   - Guardrail-Block pruefen (z. B. externer Installationswunsch -> klarer Blocker)
3. Rueckmeldung:
   - klare Statusanzeige (laufend/ok/warnung/fehler)
   - Karten/Abstaende in normaler Sidebar-Breite lesbar
   - kein erzwungener Panel-Sprung im Normalbetrieb

## Soll-Ergebnis

- Sidebar ist der Hauptpfad.
- Produktmodus und Projektagentenmodus sind dort benutzbar.
- Panel bleibt optionaler Legacy-/Debug-Weg.
