# V3 Dokumentation

## Übersicht

V3 ist der halbautomatische Ausbau über V2 hinaus mit patch-/diff-naher Änderungsdarstellung, einfachen Prüfschritten und Ergebnisbewertung.

## Was ist neu?

### 1. Patch-/diff-nahe Änderungsdarstellung

- Änderungen enthalten jetzt Zeilennummern (line_start, line_end)
- Änderungen können Dateipfade enthalten (file_path)
- Mehrere Änderungen werden klar und nachvollziehbar dargestellt
- Die Extension zeigt Zeilennummern und Dateipfade an

### 2. Einfache Prüfschritte

- Python-Syntaxprüfung kann automatisch durchgeführt werden
- Definierte Testbefehle können ausgeführt werden
- Prüfschritte sind kontrolliert und nachvollziehbar
- Ergebnisse werden mit Exit-Code, stdout und stderr erfasst

### 3. Ergebnisbewertung

- Prüfschritt-Ergebnisse werden in Statusklassen bewertet:
  - success: Erfolgreich
  - failed: Fehlgeschlagen
  - warning: Warnung
  - blocked: Blockiert
- Die Bewertung ist knapp, technisch und verständlich

## Backend-Änderungen

### Neue Schemas

- `TestStep`: Prüfschritt mit Typ (syntax_check, test_command)
- `TestResult`: Ergebnis eines Prüfschritts mit Status, Nachricht, stdout, stderr, Exit-Code
- `StructuredAnswerV3`: Erweiterte strukturierte Antwort mit Prüfschritten

### Neue Module

- `test_runner.py`: Führt Syntaxprüfung und Testbefehle aus
- `service.py`: Erweitert um Prüfschritte und Ergebnisbewertung

## Extension-Änderungen

### Neue UI-Elemente

- Anzeige von Zeilennummern (line_start, line_end)
- Anzeige von Dateipfaden (file_path)
- Prüfschritt-Button
- Ergebnisbewertungs-Anzeige

## Nutzung

### Backend starten

```powershell
powershell -File .\scripts\start_backend.ps1
```

### Backend prüfen

```powershell
powershell -File .\scripts\status_backend.ps1
```

### Extension nutzen

1. Extension öffnen: `Code KI: Assistent oeffnen`
2. Modus wählen (Python-Aufgabe, Ueberarbeiten, Erklaeren)
3. Prompt eingeben
4. Optional: Traceback eingeben
5. Optional: Zusatzdateien auf API-Ebene mitgeben (`additional_files`); die aktuelle V3-Webview hat dafuer keine eigene Dateiauswahl
6. Ausführen
7. Änderungen prüfen und anwenden
8. Prüfschritt starten
9. Ergebnisbewertung prüfen

## Beispiele

### Beispiel 1: V3-Änderung mit Zeilennummern

Prompt:
```
Verbessere diese Funktion und gib Zeilennummern an:
```

Erwartete Antwort:
```json
{
  "summary": "Funktion mit Typ-Hints und Docstring verbessert",
  "explanation": "Die Funktion wurde um Typ-Hints und einen Docstring erweitert",
  "changes": [
    {
      "type": "replace",
      "description": "Funktionssignatur und Body ersetzen",
      "file_path": "src/utils.py",
      "line_start": 15,
      "line_end": 20,
      "old_code": "def process_data(data):\n    return data",
      "new_code": "def process_data(data: dict) -> dict:\n    """"Verarbeitet die Daten."""\n    return data"
    }
  ],
  "risks": []
}
```

### Beispiel 2: Prüfschritt mit Syntaxprüfung

Nach der Änderung wird automatisch ein Prüfschritt erstellt:

Erwartetes Ergebnis:
```json
{
  "test_step": {
    "type": "syntax_check",
    "description": "Python-Syntaxprüfung der vorgeschlagenen Änderungen"
  },
  "test_result": {
    "status": "success",
    "message": "Syntaxprüfung erfolgreich: Keine Syntaxfehler gefunden",
    "stdout": "",
    "stderr": "",
    "exit_code": 0
  }
}
```

## Grenzen

V3 hat folgende bewusste Grenzen:

- Keine automatische Anwendung von Änderungen auf mehrere Dateien ohne Bestätigung
- Keine Git-Integration
- Keine vollautonome Agentik
- Prüfschritte sind auf einfache Syntaxprüfung und definierte Testbefehle beschränkt
- Ergebnisbewertung ist auf Statusklassen beschränkt

## Ausblick

Mögliche Erweiterungen für zukünftige Versionen:
- Automatische Anwendung von Änderungen auf mehrere Dateien
- Testausführung aus dem Editor heraus
- projektweite Kontextsicht
- Git-Integration
