# V2 Dokumentation

## Uebersicht

V2 erweitert V1.1 um kontrollierten Mehrdatei-Kontext, verbesserte Fehlerbehandlung und kleinere Aenderungsserien.

## Hinweis zum aktuellen Stand

`additional_files` ist im Backend und API-Schema vorhanden.
Die aktuelle V3-Webview der Extension stellt keinen eigenen Datei-Auswahlbutton fuer Zusatzdateien bereit.

## Was ist in V2 real umgesetzt?

1. Kontrollierter Mehrdatei-Kontext im Backend
- Request-Schema mit `additional_files`
- Begrenzung auf maximal 5 Zusatzdateien im Backend
- Clipping der Zusatzdatei-Inhalte wie bei Dateikontext

2. Verbesserte Fehlerbehandlung
- Tracebacks und Fehlermeldungen koennen strukturiert mitgegeben werden
- Fehlerkontext wird im Prompt priorisiert

3. Kleinere Aenderungsserien
- Strukturierte Antworten mit mehreren Aenderungen sind moeglich
- Risiken/Nebenwirkungen koennen mitgeliefert werden

## Backend-Aenderungen

- `schemas.py`: `AdditionalFile` und erweitertes `AssistRequest`
- `context_builder.py`: Verarbeitung von Zusatzdateien mit Begrenzung
- `prompting.py`: Regeln fuer Mehrdatei-Kontext
- `config.py`: `max_additional_files`

## Extension-Stand

- Die Extension zeigt die Anzahl von `additional_files` im Kontext an, falls diese im Payload vorhanden sind.
- Eine interaktive Zusatzdatei-Auswahl in der Webview ist im aktuellen Stand nicht implementiert.

## Einschraenkungen

- Keine automatische Anwendung auf mehrere Dateien
- Keine Git-Integration
- Keine vollautonome Agentik

## Ausblick

- Zusatzdatei-Auswahl in der UI kann spaeter nachgezogen werden
- Weitere Stabilisierung und Testabdeckung vor groesseren Ausbaustufen
