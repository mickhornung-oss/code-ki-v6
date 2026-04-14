# V6 Minimal Product Flow

## Produktziel

V6 ist der produktnahe Standardmodus:
Prompt rein, Code raus.

Der Nutzer soll nicht durch eine sichtbare Laborpflichtkette gefuehrt werden, sondern schnell zu einem belastbaren Vorschlag kommen.

## Sichtbar im Standardmodus

1. Auftrag eingeben
2. Antwort mit strukturierten Aenderungsvorschlaegen
3. kompakter V6-Status
4. optional Apply
5. optional Pruefschritt

## Intern genutzte Leitplanken (aus V4/V5)

- Guardrail: aktive Python-Datei erforderlich
- risikogesteuerte Sichtbarkeit (low/medium/high)
- sichere Apply-Mechanik (S1/S2)
- interne Mechanikhinweise fuer Planungs-/Praezisierungslogik

## Risiko-Regeln (aktuell)

- `low`: keine Aenderung oder kleine Einzeldatei-Aenderung
- `medium`: z. B. delete, groesserer Zeilenbereich, viele Aenderungen
- `high`: z. B. Mehrdatei-Aenderung oder instabile strukturierte Antwort

## Abgrenzung zu V5

- V5 bleibt Testlabor (opt-in) mit sichtbarer Mehrstufenkette.
- V6 uebernimmt nur den nutzbaren Kern fuer den Produktfluss.
- Keine sichtbare V5-Laborpflichtkette im V6-Standardmodus.

## Verbindung zum Projektagenten

- Fuer moeglichst autonome Projektarbeit steht zusaetzlich `agent_project` bereit.
- `agent_project` nutzt dieselben Sicherheitsleitplanken und erzwingt Projektordner-Grenzen.
- Produktmodus (`agent_v6`) bleibt schlank; Projektagent ist der erweiterte Ausfuehrungspfad nach Freigabe.
