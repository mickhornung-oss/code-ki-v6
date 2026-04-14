from __future__ import annotations

import re
from pathlib import Path

from backend.config import AppConfig
from backend.schemas import AssistRequest, StructuredAnswerV3, V4Checkpoint, V4PlanStep, V4Workflow

_PROMPT_STOPWORDS = {
    "the",
    "and",
    "for",
    "with",
    "this",
    "that",
    "from",
    "into",
    "oder",
    "und",
    "mit",
    "fuer",
    "eine",
    "einer",
    "einen",
    "python",
    "datei",
    "files",
}


def _prompt_keywords(prompt: str) -> list[str]:
    tokens = re.findall(r"[a-zA-Z_][a-zA-Z0-9_]{2,}", prompt.lower())
    unique: list[str] = []
    for token in tokens:
        if token in _PROMPT_STOPWORDS:
            continue
        if token not in unique:
            unique.append(token)
    return unique[:20]


def select_relevant_files(request: AssistRequest, config: AppConfig) -> list[str]:
    selected: list[str] = []
    if request.current_file_path:
        selected.append(request.current_file_path)

    for file in request.additional_files[: config.max_additional_files]:
        if file.file_path not in selected:
            selected.append(file.file_path)

    keywords = _prompt_keywords(request.prompt)
    scored: list[tuple[int, str]] = []
    for file_path in request.workspace_files[: config.max_workspace_files]:
        if file_path in selected:
            continue
        lowered = file_path.lower()
        score = 0
        file_name = Path(file_path).name.lower()
        for keyword in keywords:
            if keyword in file_name:
                score += 3
            elif keyword in lowered:
                score += 1
        if score > 0:
            scored.append((score, file_path))

    for _, file_path in sorted(scored, key=lambda item: (-item[0], len(item[1]))):
        selected.append(file_path)
        if len(selected) >= config.v4_file_suggestion_limit + (1 if request.current_file_path else 0):
            break

    return selected


def build_v4_workflow(
    request: AssistRequest,
    config: AppConfig,
    *,
    structured: StructuredAnswerV3 | None,
    parse_error: str,
    context_summary: dict,
) -> V4Workflow:
    if not request.current_file_path:
        plan = [
            V4PlanStep(
                id="plan",
                title="Auftrag analysieren",
                purpose="Arbeitsauftrag in kontrollierte Teilschritte aufteilen",
                status="success",
                details=f"Prompt-Laenge: {len(request.prompt.strip())} Zeichen",
            ),
            V4PlanStep(
                id="file_selection",
                title="Relevante Dateien bestimmen",
                purpose="Aktive Python-Datei als sicherer Arbeitskontext erforderlich",
                status="blocked",
                details="Keine aktive Python-Datei im Kontext uebergeben.",
            ),
            V4PlanStep(id="change_proposal", title="Aenderungen vorbereiten", purpose="Patch-nahe Aenderungsvorschlaege erzeugen", status="skipped"),
            V4PlanStep(id="apply_checkpoint", title="Kontrollpunkt vor Anwendung", purpose="Nutzerbestaetigung vor Dateiaenderung einholen", status="skipped"),
            V4PlanStep(id="test_step", title="Pruefschritt ausfuehren", purpose="Aenderungen mit kleinem Pruefschritt absichern", status="skipped"),
            V4PlanStep(id="evaluation", title="Ergebnis bewerten", purpose="Gesamtstatus und naechste Aktion zusammenfassen", status="success", details="Ablauf kontrolliert blockiert."),
        ]
        checkpoints = [
            V4Checkpoint(
                id="require_active_python_file",
                title="Aktive Python-Datei erforderlich",
                required=True,
                status="required",
                message="Bitte eine Python-Datei im Editor aktivieren und den V4-Lauf erneut starten.",
            )
        ]
        return V4Workflow(
            plan=plan,
            relevant_files=[],
            checkpoints=checkpoints,
            final_status="blocked",
            final_message="V4-Lauf blockiert: Es wurde keine aktive Python-Datei uebergeben.",
            next_action="Python-Datei aktivieren und Auftrag erneut ausfuehren.",
        )

    if not str(request.current_file_path).lower().endswith(".py"):
        plan = [
            V4PlanStep(
                id="plan",
                title="Auftrag analysieren",
                purpose="Arbeitsauftrag in kontrollierte Teilschritte aufteilen",
                status="success",
                details=f"Prompt-Laenge: {len(request.prompt.strip())} Zeichen",
            ),
            V4PlanStep(
                id="file_selection",
                title="Relevante Dateien bestimmen",
                purpose="Aktive Python-Datei als sicherer Arbeitskontext erforderlich",
                status="blocked",
                details=f"Nicht-Python-Datei erkannt: {request.current_file_path}",
            ),
            V4PlanStep(id="change_proposal", title="Aenderungen vorbereiten", purpose="Patch-nahe Aenderungsvorschlaege erzeugen", status="skipped"),
            V4PlanStep(id="apply_checkpoint", title="Kontrollpunkt vor Anwendung", purpose="Nutzerbestaetigung vor Dateiaenderung einholen", status="skipped"),
            V4PlanStep(id="test_step", title="Pruefschritt ausfuehren", purpose="Aenderungen mit kleinem Pruefschritt absichern", status="skipped"),
            V4PlanStep(id="evaluation", title="Ergebnis bewerten", purpose="Gesamtstatus und naechste Aktion zusammenfassen", status="success", details="Ablauf kontrolliert blockiert."),
        ]
        checkpoints = [
            V4Checkpoint(
                id="require_python_file_type",
                title="Python-Datei erforderlich",
                required=True,
                status="required",
                message="Bitte eine .py-Datei als aktive Datei verwenden.",
            )
        ]
        return V4Workflow(
            plan=plan,
            relevant_files=[],
            checkpoints=checkpoints,
            final_status="blocked",
            final_message="V4-Lauf blockiert: Aktive Datei ist keine Python-Datei.",
            next_action="Python-Datei oeffnen und Auftrag erneut ausfuehren.",
        )

    control = dict(request.v4_control or {})
    continue_after_plan = bool(control.get("continue_after_plan", True))
    continue_after_file_selection = bool(control.get("continue_after_file_selection", True))
    continue_after_change_proposal = bool(control.get("continue_after_change_proposal", True))

    relevant_files = select_relevant_files(request, config)
    plan = [
        V4PlanStep(
            id="plan",
            title="Auftrag analysieren",
            purpose="Arbeitsauftrag in kontrollierte Teilschritte aufteilen",
            status="success",
            details=f"Prompt-Laenge: {len(request.prompt.strip())} Zeichen",
        ),
        V4PlanStep(
            id="file_selection",
            title="Relevante Dateien bestimmen",
            purpose="Aktive Datei, Zusatzdateien und passende Kandidaten priorisieren",
            status="pending",
            files=relevant_files,
        ),
        V4PlanStep(
            id="change_proposal",
            title="Aenderungen vorbereiten",
            purpose="Patch-nahe Aenderungsvorschlaege erzeugen",
            status="pending",
        ),
        V4PlanStep(
            id="apply_checkpoint",
            title="Kontrollpunkt vor Anwendung",
            purpose="Nutzerbestaetigung vor Dateiaenderung einholen",
            status="pending",
        ),
        V4PlanStep(
            id="test_step",
            title="Pruefschritt ausfuehren",
            purpose="Aenderungen mit kleinem Pruefschritt absichern",
            status="pending",
        ),
        V4PlanStep(
            id="evaluation",
            title="Ergebnis bewerten",
            purpose="Gesamtstatus und naechste Aktion zusammenfassen",
            status="pending",
        ),
    ]

    checkpoints: list[V4Checkpoint] = []

    # Step 2: file selection
    if continue_after_plan:
        plan[1].status = "success"
        plan[1].details = f"{len(relevant_files)} relevante Datei(en) bestimmt"
    else:
        plan[1].status = "blocked"
        plan[1].details = "Stopppunkt: Freigabe nach Plan erforderlich"
        checkpoints.append(
            V4Checkpoint(
                id="confirm_plan",
                title="Plan bestaetigen",
                required=True,
                status="required",
                message="Bitte Plan und Dateiauswahl pruefen und danach den Lauf fortsetzen.",
            )
        )
        return V4Workflow(
            plan=plan,
            relevant_files=relevant_files,
            checkpoints=checkpoints,
            final_status="blocked",
            final_message="V4-Lauf an Plan-Kontrollpunkt pausiert.",
            next_action="continue_after_plan=true setzen und erneut ausfuehren.",
        )

    if not continue_after_file_selection:
        plan[2].status = "blocked"
        plan[2].details = "Stopppunkt: Freigabe nach Dateiauswahl erforderlich"
        checkpoints.append(
            V4Checkpoint(
                id="confirm_file_selection",
                title="Dateiauswahl bestaetigen",
                required=True,
                status="required",
                message="Dateiauswahl pruefen und Lauf danach fortsetzen.",
            )
        )
        return V4Workflow(
            plan=plan,
            relevant_files=relevant_files,
            checkpoints=checkpoints,
            final_status="blocked",
            final_message="V4-Lauf an Dateiauswahl-Kontrollpunkt pausiert.",
            next_action="continue_after_file_selection=true setzen und erneut ausfuehren.",
        )

    # Step 3: change proposal
    if structured is None:
        plan[2].status = "failed"
        plan[2].details = parse_error or "Modellantwort konnte nicht strukturiert geparst werden."
        plan[3].status = "skipped"
        plan[4].status = "skipped"
        plan[5].status = "success"
        plan[5].details = "Ablauf mit Fehler beendet."
        return V4Workflow(
            plan=plan,
            relevant_files=relevant_files,
            checkpoints=checkpoints,
            final_status="failed",
            final_message="Aenderungsvorschlaege konnten nicht sicher erzeugt werden.",
            next_action="Prompt konkretisieren oder Kontext erweitern und erneut versuchen.",
        )

    plan[2].status = "success"
    plan[2].details = f"{len(structured.changes)} Aenderung(en) vorgeschlagen"

    if not continue_after_change_proposal:
        plan[3].status = "blocked"
        plan[3].details = "Stopppunkt: Freigabe nach Aenderungsvorschlag erforderlich"
        checkpoints.append(
            V4Checkpoint(
                id="confirm_change_proposal",
                title="Aenderungsvorschlaege bestaetigen",
                required=True,
                status="required",
                message="Bitte Vorschlaege pruefen und bei Bedarf anwenden.",
            )
        )
        return V4Workflow(
            plan=plan,
            relevant_files=relevant_files,
            checkpoints=checkpoints,
            final_status="blocked",
            final_message="V4-Lauf an Aenderungs-Kontrollpunkt pausiert.",
            next_action="continue_after_change_proposal=true setzen und erneut ausfuehren.",
        )

    if structured.changes:
        plan[3].status = "blocked"
        plan[3].details = "Wartet auf manuelle Bestaetigung und Apply in VS Code"
        checkpoints.append(
            V4Checkpoint(
                id="apply_changes",
                title="Aenderungen anwenden",
                required=True,
                status="required",
                message="Aenderungen im Panel pruefen und ueber 'Aenderungen uebernehmen' anwenden.",
            )
        )
        if structured.test_step is not None:
            plan[4].status = "pending"
            plan[4].details = "Nach Apply ueber 'Pruefschritt ausfuehren' starten."
        else:
            plan[4].status = "skipped"
            plan[4].details = "Kein Pruefschritt empfohlen."
        plan[5].status = "success"
        plan[5].details = "Teilstatus: wartet auf Anwenderfreigabe."
        return V4Workflow(
            plan=plan,
            relevant_files=relevant_files,
            checkpoints=checkpoints,
            final_status="blocked",
            final_message="Aenderungen bereit. Lauf wartet auf Nutzerbestaetigung.",
            next_action="Aenderungen anwenden und danach Pruefschritt ausfuehren.",
        )

    plan[3].status = "skipped"
    plan[3].details = "Keine Dateiaenderungen vorgeschlagen."
    if structured.test_step or structured.test_result:
        plan[4].status = "success" if structured.test_result else "pending"
        plan[4].details = (
            f"Pruefschritt-Status: {structured.test_result.status}" if structured.test_result else "Pruefschritt verfuegbar"
        )
    else:
        plan[4].status = "skipped"
        plan[4].details = "Kein Pruefschritt noetig."
    plan[5].status = "success"
    plan[5].details = "Ablauf ohne Dateiaenderung abgeschlossen."
    final_status = "successful"
    final_message = "V4-Lauf erfolgreich abgeschlossen."
    if structured.test_result and structured.test_result.status in {"failed", "warning"}:
        final_status = "partial"
        final_message = "V4-Lauf teilweise erfolgreich: Vorschlag ohne Dateiaenderung, aber Pruefschritt zeigt Probleme."
    return V4Workflow(
        plan=plan,
        relevant_files=relevant_files,
        checkpoints=checkpoints,
        final_status=final_status,
        final_message=final_message,
        next_action=None,
    )
