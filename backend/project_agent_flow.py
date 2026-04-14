from __future__ import annotations

from backend.project_guardrails import (
    detect_external_blocker,
    detect_out_of_scope_changes,
    resolve_project_root,
)
from backend.schemas import AssistRequest, ProjectAgentFlow, StructuredAnswerV3, V4PlanStep


def build_project_agent_flow(
    request: AssistRequest,
    *,
    structured: StructuredAnswerV3 | None,
    parse_error: str,
) -> ProjectAgentFlow:
    project_root = resolve_project_root(request.workspace_root)
    autonomy_approved = bool((request.agent_control or {}).get("autonomy_approved", False))

    steps = [
        V4PlanStep(id="analyze", title="Auftrag analysieren", purpose="Aufgabe und Kontext erfassen", status="success"),
        V4PlanStep(id="locate_files", title="Dateien bestimmen", purpose="Relevante Dateien im Projektordner finden", status="pending"),
        V4PlanStep(id="propose", title="Vorschlag erzeugen", purpose="Strukturierte Aenderungen erzeugen", status="pending"),
        V4PlanStep(id="apply", title="Aenderungen anwenden", purpose="Aenderungen kontrolliert in der aktiven Datei umsetzen", status="pending"),
        V4PlanStep(id="test", title="Pruefschritt ausfuehren", purpose="Syntax-/Testcheck ausfuehren", status="pending"),
        V4PlanStep(id="evaluate", title="Ergebnis bewerten", purpose="Status und naechste Aktion liefern", status="pending"),
    ]

    if not project_root:
        steps[1].status = "blocked"
        steps[5].status = "success"
        return ProjectAgentFlow(
            agent_label="Lokaler Projektagent",
            autonomy_approved=autonomy_approved,
            allowed_project_root=None,
            steps=steps,
            escalation_type="out_of_scope",
            escalation_reason="Kein gueltiger Projektordner vorhanden.",
            final_status="blocked",
            final_message="Projektagent blockiert: workspace_root fehlt oder ist ungueltig.",
            next_action="Projektordner in VS Code oeffnen und erneut ausfuehren.",
        )

    steps[1].status = "success"
    steps[1].details = project_root

    if not autonomy_approved:
        steps[2].status = "blocked"
        steps[3].status = "skipped"
        steps[4].status = "skipped"
        steps[5].status = "success"
        return ProjectAgentFlow(
            agent_label="Lokaler Projektagent",
            autonomy_approved=False,
            allowed_project_root=project_root,
            steps=steps,
            escalation_type="none",
            final_status="blocked",
            final_message="Projektagent wartet auf explizite Freigabe fuer autonome Ausfuehrung.",
            next_action="Autonomie-Freigabe aktivieren und Auftrag erneut starten.",
        )

    external_blocker = detect_external_blocker(request.prompt)
    if external_blocker:
        steps[2].status = "blocked"
        steps[3].status = "skipped"
        steps[4].status = "skipped"
        steps[5].status = "success"
        return ProjectAgentFlow(
            agent_label="Lokaler Projektagent",
            autonomy_approved=True,
            allowed_project_root=project_root,
            steps=steps,
            escalation_type="external_blocker",
            escalation_reason=external_blocker,
            final_status="blocked",
            final_message="Projektagent gestoppt: externer Blocker erkannt.",
            next_action="Explizite Nutzerfreigabe fuer externen Eingriff einholen.",
        )

    if parse_error or structured is None:
        steps[2].status = "failed"
        steps[3].status = "skipped"
        steps[4].status = "skipped"
        steps[5].status = "success"
        return ProjectAgentFlow(
            agent_label="Lokaler Projektagent",
            autonomy_approved=True,
            allowed_project_root=project_root,
            steps=steps,
            escalation_type="none",
            final_status="failed",
            final_message="Projektagent konnte keinen sicheren strukturierten Vorschlag erzeugen.",
            next_action="Auftrag konkretisieren und erneut starten.",
        )

    has_active_file_context = bool(request.current_file_path and request.current_file_text)
    if not has_active_file_context and structured.changes:
        ambiguous_changes = [change for change in structured.changes if not change.file_path]
        if ambiguous_changes:
            steps[2].status = "blocked"
            steps[2].details = "Aenderungsvorschlaege ohne expliziten Dateipfad sind ohne aktive Datei nicht erlaubt."
            steps[3].status = "skipped"
            steps[4].status = "skipped"
            steps[5].status = "success"
            return ProjectAgentFlow(
                agent_label="Lokaler Projektagent",
                autonomy_approved=True,
                allowed_project_root=project_root,
                steps=steps,
                escalation_type="none",
                final_status="blocked",
                final_message=(
                    "Projektweite Analyse ohne aktive Datei ist erlaubt, "
                    "aber dateiunscharfe Aenderungsvorschlaege bleiben blockiert."
                ),
                next_action=(
                    "Fuer Aenderungen entweder eine aktive Python-Datei oeffnen "
                    "oder explizite file_path-Ziele je Aenderung liefern."
                ),
            )

    out_of_scope_change = detect_out_of_scope_changes(structured, project_root)
    if out_of_scope_change:
        steps[2].status = "blocked"
        steps[3].status = "skipped"
        steps[4].status = "skipped"
        steps[5].status = "success"
        return ProjectAgentFlow(
            agent_label="Lokaler Projektagent",
            autonomy_approved=True,
            allowed_project_root=project_root,
            steps=steps,
            escalation_type="out_of_scope",
            escalation_reason=out_of_scope_change,
            final_status="blocked",
            final_message="Projektagent blockiert: out-of-scope Aenderung erkannt.",
            next_action="Aenderungen auf Projektordner begrenzen und erneut ausfuehren.",
        )

    steps[2].status = "success"
    steps[2].details = f"{len(structured.changes)} Aenderung(en) vorgeschlagen"
    steps[3].status = "success" if structured.changes else "skipped"
    steps[3].details = "Auto-Apply wird in der Extension kontrolliert ausgeloest." if structured.changes else "Keine Aenderungen zum Anwenden."
    steps[4].status = "success" if structured.test_step else "skipped"
    steps[4].details = "Pruefschritt automatisiert eingehaengt." if structured.test_step else "Kein Pruefschritt vorhanden."
    steps[5].status = "success"

    return ProjectAgentFlow(
        agent_label="Lokaler Projektagent",
        autonomy_approved=True,
        allowed_project_root=project_root,
        steps=steps,
        escalation_type="none",
        final_status="successful",
        final_message="Projektagentlauf innerhalb des Projektordners vorbereitet.",
        next_action="Ergebnis pruefen; Apply/Test laufen kontrolliert innerhalb des Projektordners.",
    )
