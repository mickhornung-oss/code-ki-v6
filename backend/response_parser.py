"""
Response Parser für V1.1
Parst strukturierte JSON-Antworten vom Modell.
"""

from __future__ import annotations

import json
import re
from typing import Any

from backend.schemas import StructuredAnswerV3


def _parse_json_relaxed(raw: str) -> tuple[Any | None, str]:
    """
    Try to parse JSON; on failure, retry with mild repairs:
    - strip BOM
    - escape lone backslashes (typisch bei Windows-Pfaden aus dem Modell)
    """
    candidates: list[tuple[str, str]] = [
        ("original", raw),
        ("no_bom", raw.lstrip("\ufeff")),
    ]

    # Escape single backslashes not already escaped (handles c:\path and \n etc.)
    escaped_once = re.sub(r"(?<!\\)\\", r"\\\\", raw)
    candidates.append(("escaped_backslashes", escaped_once))

    for label, candidate in candidates:
        try:
            return json.loads(candidate), ""
        except json.JSONDecodeError as e:
            last_error = f"{label}: {str(e)}"
            continue
    return None, f"Kein gültiges JSON: {last_error}"


def parse_structured_answer(raw_answer: str) -> tuple[StructuredAnswerV3 | None, str]:
    """
    Parst die rohe Modellantwort und extrahiert strukturierte Daten.
    V3: Validiert Zeilennummern und Dateipfade.

    Args:
        raw_answer: Rohe Antwort vom Modell

    Returns:
        Tuple aus (StructuredAnswer oder None, Fehlermeldung oder "")
    """
    # Versuche, JSON zu parsen (auch mit leichten Reparaturen)
    data, parse_err = _parse_json_relaxed(raw_answer.strip())
    if data is None:
        return None, parse_err

    try:
        # V3: Validiere Änderungen
        changes_data = data.get("changes", [])
        validated_changes = []
        for change in changes_data:
            # V3: Validiere Zeilennummern
            line_start = change.get("line_start")
            line_end = change.get("line_end")
            if line_start is not None and line_end is not None:
                if line_start < 1 or line_end < 1:
                    return None, f"Ungültige Zeilennummern: {line_start}, {line_end}"
                if line_start > line_end:
                    return (
                        None,
                        f"Startzeile größer als Endzeile: {line_start} > {line_end}",
                    )

            file_path = change.get("file_path")
            if file_path and not isinstance(file_path, str):
                return None, f"Ungültiger Dateipfad: {file_path}"

            validated_changes.append(change)

        structured = StructuredAnswerV3(
            summary=data.get("summary", "Keine Zusammenfassung"),
            explanation=data.get("explanation"),
            changes=validated_changes,
            risks=data.get("risks", []),
            test_step=data.get("test_step"),
            test_result=data.get("test_result"),
        )

        return structured, ""
    except Exception as e:
        return None, f"Fehler beim Parsen: {str(e)}"


def extract_json_from_text(text: str) -> str:
    """
    Extrahiert JSON aus einem Text, falls JSON mit {} markiert ist.

    Args:
        text: Text, der JSON enthalten könnte

    Returns:
        Extrahierter JSON-String oder der ursprüngliche Text
    """
    text = text.strip()

    # Suche nach JSON-Objekt im Text
    start = text.find("{")
    end = text.rfind("}")

    if start != -1 and end != -1 and end > start:
        return text[start : end + 1]

    return text
