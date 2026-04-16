from __future__ import annotations

from backend.schemas import AssistRequest, StructuredAnswerV3, V6ProductFlow


def _is_python_context_valid(request: AssistRequest) -> tuple[bool, str | None]:
    if not request.current_file_path:
        return False, "Keine aktive Python-Datei im Kontext."
    if not str(request.current_file_path).lower().endswith(".py"):
        return False, "Aktive Datei ist keine Python-Datei."
    return True, None


def _estimate_risk(
    request: AssistRequest, structured: StructuredAnswerV3 | None, parse_error: str
) -> tuple[str, list[str]]:
    reasons: list[str] = []
    risk_level = "low"

    if parse_error:
        reasons.append(
            "Modellantwort konnte nicht stabil als strukturierte Antwort geparst werden."
        )
        return "high", reasons

    if structured is None:
        reasons.append("Keine strukturierte Antwort verfuegbar.")
        return "high", reasons

    changes = list(structured.changes or [])
    if not changes:
        return "low", reasons

    target_files: set[str] = set()
    for change in changes:
        if change.file_path:
            target_files.add(change.file_path)
        elif request.current_file_path:
            target_files.add(request.current_file_path)

        if change.type == "delete":
            reasons.append("Delete-Aenderung erkannt.")
            risk_level = "medium"

        if change.line_start and change.line_end:
            span = change.line_end - change.line_start + 1
            if span >= 25:
                reasons.append(f"Groesserer Zeilenbereich betroffen ({span} Zeilen).")
                risk_level = "medium"

    if len(changes) >= 3:
        reasons.append(f"Mehrere Aenderungen in einem Lauf ({len(changes)}).")
        risk_level = "medium"

    if len(target_files) >= 2:
        reasons.append("Mehrdatei-Aenderungsvorschlaege erkannt.")
        return "high", reasons

    if len(request.additional_files) >= 3:
        reasons.append("Breiter Zusatzkontext aktiv.")
        risk_level = "medium"

    return risk_level, reasons


def build_v6_product_flow(
    request: AssistRequest,
    *,
    structured: StructuredAnswerV3 | None,
    parse_error: str,
) -> V6ProductFlow:
    valid_python_context, context_error = _is_python_context_valid(request)
    if not valid_python_context:
        return V6ProductFlow(
            product_label="V6 Minimal Product Flow",
            risk_level="high",
            risk_reasons=[context_error or "Kontextfehler"],
            visible_controls=["context_blocker"],
            internal_mechanisms=["v4_context_guardrails"],
            final_status="blocked",
            final_message=f"V6 blockiert: {context_error}",
            next_action="Python-Datei aktivieren und Auftrag erneut ausfuehren.",
        )

    risk_level, risk_reasons = _estimate_risk(request, structured, parse_error)
    visible_controls = ["compact_result"]
    if risk_level in {"medium", "high"}:
        visible_controls.append("risk_notice")
    if risk_level == "high":
        visible_controls.append("review_before_apply")
    if structured and structured.test_step:
        visible_controls.append("test_step_recommended")

    internal_mechanisms = [
        "internal_alternative_planning",
        "refinement_types_available",
        "safe_apply_guardrails",
    ]

    if parse_error:
        return V6ProductFlow(
            product_label="V6 Minimal Product Flow",
            risk_level="high",
            risk_reasons=risk_reasons,
            visible_controls=visible_controls,
            internal_mechanisms=internal_mechanisms,
            final_status="failed",
            final_message="V6 konnte keinen sicheren strukturierten Vorschlag erzeugen.",
            next_action="Prompt konkretisieren und erneut ausfuehren.",
        )

    final_status = "successful"
    final_message = "V6-Lauf erfolgreich: kompakter Produktfluss ausgefuehrt."
    next_action = "Vorschlag pruefen, optional anwenden und Pruefschritt ausfuehren."

    if risk_level == "high":
        final_status = "partial"
        final_message = (
            "V6-Lauf mit erhoehter Vorsicht: bitte Vorschlaege vor Apply genau pruefen."
        )
        next_action = (
            "Vor Anwendung zuerst Risikohinweise pruefen, dann optional anwenden."
        )
    elif risk_level == "medium":
        final_status = "partial"
        final_message = "V6-Lauf mit moderatem Risiko: Vorschlag ist vorhanden, zusaetzliche Pruefung empfohlen."
        next_action = "Vorschlag pruefen und anschliessend Pruefschritt ausfuehren."

    return V6ProductFlow(
        product_label="V6 Minimal Product Flow",
        risk_level=risk_level,  # type: ignore[arg-type]
        risk_reasons=risk_reasons,
        visible_controls=visible_controls,
        internal_mechanisms=internal_mechanisms,
        final_status=final_status,  # type: ignore[arg-type]
        final_message=final_message,
        next_action=next_action,
    )
