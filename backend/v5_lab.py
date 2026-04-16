from __future__ import annotations

from backend.config import AppConfig
from backend.schemas import AssistRequest, V4PlanStep, V5AlternativePlan, V5LabWorkflow
from backend.v4_workflow import select_relevant_files


def _conservative_plan(
    request: AssistRequest, relevant_files: list[str]
) -> V5AlternativePlan:
    active_file = request.current_file_path or "aktive-datei.py"
    steps = [
        V4PlanStep(
            id="scope",
            title="Kontext begrenzen",
            purpose="Nur aktive Datei fuer minimale Risiken verwenden",
            status="pending",
            files=[active_file],
            details="Keine Zusatzdateien, keine breitere Kontextausweitung.",
        ),
        V4PlanStep(
            id="propose",
            title="Kleine Aenderung vorschlagen",
            purpose="Eine sichere, lokal nachvollziehbare Verbesserung vorbereiten",
            status="pending",
            files=[active_file],
        ),
        V4PlanStep(
            id="verify",
            title="Lokalen Pruefschritt ausfuehren",
            purpose="Syntax-/Smokecheck nur fuer die aktive Datei",
            status="pending",
            files=[active_file],
        ),
    ]
    return V5AlternativePlan(
        id="plan_a_conservative",
        title="Plan A - konservativ",
        strategy="Nur aktive Python-Datei, minimal invasive Verbesserung",
        risk_level="low",
        steps=steps,
        files=[active_file],
    )


def _bolder_plan(
    request: AssistRequest, relevant_files: list[str]
) -> V5AlternativePlan:
    active_file = request.current_file_path or "aktive-datei.py"
    candidate_files = [path for path in relevant_files if path != active_file][:2]
    files = [active_file] + candidate_files
    steps = [
        V4PlanStep(
            id="map",
            title="Kontext mit Kandidatendateien mappen",
            purpose="Aktive Datei plus kleine, verwandte Dateien fuer Alternativen einbeziehen",
            status="pending",
            files=files,
            details="Maximal zwei Zusatzkandidaten aus kontrollierter Dateiauswahl.",
        ),
        V4PlanStep(
            id="compare",
            title="Zwei Aenderungsansatze vergleichen",
            purpose="Lokale Loesung gegen leicht breiteren Refactor-Ansatz abwaegen",
            status="pending",
            files=files,
        ),
        V4PlanStep(
            id="verify",
            title="Pruefschritt mit Fokus auf Seiteneffekte",
            purpose="Nach geplanter Aenderung gezielten Regression-Schnellcheck vorbereiten",
            status="pending",
            files=[active_file],
        ),
    ]
    return V5AlternativePlan(
        id="plan_b_bolder",
        title="Plan B - mutiger",
        strategy="Aktive Datei plus kleine Kontexterweiterung fuer Alternativenvergleich",
        risk_level="medium",
        steps=steps,
        files=files,
    )


def build_v5_lab_workflow(request: AssistRequest, config: AppConfig) -> V5LabWorkflow:
    if not config.v5_lab_enabled:
        return V5LabWorkflow(
            experiment_id="v5.7-plan-selection-refinement-types",
            experiment_label="V5.7 Testlabor - Mehrplan mit Planwahl, Preview, Dry-Run, Diff, Praezisierung und Typen",
            lab_enabled=False,
            alternatives=[],
            comparison_summary="Laborpfad ist per Marker deaktiviert.",
            final_status="blocked",
            final_message="V5.7 ist deaktiviert. Marker in config/v5_lab_marker.json aktivieren.",
            next_action="v5_lab.enabled auf true setzen und Lauf erneut starten.",
        )

    if not request.current_file_path:
        return V5LabWorkflow(
            experiment_id="v5.7-plan-selection-refinement-types",
            experiment_label="V5.7 Testlabor - Mehrplan mit Planwahl, Preview, Dry-Run, Diff, Praezisierung und Typen",
            lab_enabled=True,
            alternatives=[],
            comparison_summary="Aktiver Python-Kontext fehlt.",
            final_status="blocked",
            final_message="V5.7 blockiert: Keine aktive Python-Datei uebergeben.",
            next_action="Python-Datei aktivieren und V5.7 erneut ausfuehren.",
        )

    if not str(request.current_file_path).lower().endswith(".py"):
        return V5LabWorkflow(
            experiment_id="v5.7-plan-selection-refinement-types",
            experiment_label="V5.7 Testlabor - Mehrplan mit Planwahl, Preview, Dry-Run, Diff, Praezisierung und Typen",
            lab_enabled=True,
            alternatives=[],
            comparison_summary="Nicht-Python-Datei als aktiver Kontext erkannt.",
            final_status="blocked",
            final_message="V5.7 blockiert: Aktive Datei ist keine Python-Datei.",
            next_action="Eine .py-Datei aktivieren und V5.7 erneut ausfuehren.",
        )

    relevant_files = select_relevant_files(request, config)
    plan_a = _conservative_plan(request, relevant_files)
    plan_b = _bolder_plan(request, relevant_files)

    return V5LabWorkflow(
        experiment_id="v5.7-plan-selection-refinement-types",
        experiment_label="V5.7 Testlabor - Mehrplan mit Planwahl, Preview, Dry-Run, Diff, Praezisierung und Typen",
        lab_enabled=True,
        alternatives=[plan_a, plan_b],
        comparison_summary=(
            "Plan A minimiert Risiko mit Fokus auf die aktive Datei. "
            "Plan B erweitert den Kontext kontrolliert fuer alternative Vorgehensweisen."
        ),
        final_status="successful",
        final_message="V5.7 hat zwei alternative Mini-Plaene erzeugt. Plan waehlen, Checkpoints pruefen und kontrolliert uebergeben.",
        next_action="In der V5-Ansicht Plan A oder B explizit waehlen.",
    )
