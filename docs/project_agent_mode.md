# Projektagent-Modus

## Zweck

Der Projektagent ermoeglicht nach expliziter Freigabe eine moeglichst autonome Ausfuehrung innerhalb des erlaubten Projektordners.

## Aktivierung

- Modus in der Extension: `Projektagent (autonom nach Freigabe)`
- Checkbox setzen: `Autonomie-Freigabe fuer Projektagent`

Ohne Freigabe startet der Agent nicht autonom.

## Feste Grenzen

- nur im `workspace_root` (erlaubter Projektordner)
- blockiert out-of-scope Pfade
- blockiert externe Eingriffe (Install/Download) und fordert gezielte Rueckfrage

## Ablauf

1. Auftrag analysieren
2. relevante Dateien bestimmen
3. strukturierte Aenderungen erzeugen
4. kontrolliert anwenden (innerhalb Projektordner)
5. Pruefschritt ausfuehren
6. Ergebnisstatus liefern

## Eskalation

- `external_blocker`: externer Eingriff erkannt
- `out_of_scope`: Zugriff ausserhalb Projektordner
- `none`: normale interne Projektausfuehrung
