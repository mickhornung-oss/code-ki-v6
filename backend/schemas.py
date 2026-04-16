from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

WorkMode = Literal[
    "python_task",
    "rewrite",
    "explain",
    "agent_v4",
    "agent_v5_lab",
    "agent_v6",
    "agent_project",
]
ExecutionStepStatus = Literal[
    "pending", "running", "success", "failed", "blocked", "skipped"
]
WorkflowFinalStatus = Literal["successful", "partial", "failed", "blocked"]


class AdditionalFile(BaseModel):
    """Zusatzdatei fuer kontrollierten Mehrdatei-Kontext in V2."""

    file_path: str = Field(description="Pfad zur Zusatzdatei relativ zum Workspace")
    file_text: str = Field(description="Inhalt der Zusatzdatei")
    description: str | None = Field(
        default=None,
        description="Optionale Beschreibung, warum diese Datei relevant ist",
    )


class AssistRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=6000)
    mode: WorkMode = "python_task"
    current_file_path: str | None = None
    current_file_text: str | None = None
    selected_text: str | None = None
    workspace_root: str | None = None
    traceback_text: str | None = None
    additional_files: list[AdditionalFile] = Field(
        default_factory=list,
        description="Zusatzdateien fuer kontrollierten Mehrdatei-Kontext in V2",
    )
    workspace_files: list[str] = Field(
        default_factory=list,
        description="Optionaler Workspace-Dateiindex fuer kontrollierte Dateiauswahl in V4",
    )
    v4_control: dict | None = Field(
        default=None, description="Kontrolloptionen fuer V4-Workflow"
    )
    agent_control: dict | None = Field(
        default=None, description="Kontrolloptionen fuer den Projektagenten"
    )


class CodeChange(BaseModel):
    """V3: Patch-/diff-nahe Aenderungsbeschreibung mit Zeilennummern und Dateipfad."""

    type: Literal["replace", "insert", "delete"] = Field(
        description="Art der Aenderung"
    )
    description: str = Field(description="Kurze Beschreibung der Aenderung")
    file_path: str | None = Field(
        default=None, description="Pfad zur Datei, in der geaendert werden soll (V3)"
    )
    line_start: int | None = Field(
        default=None, description="Startzeile der Aenderung (V3)"
    )
    line_end: int | None = Field(
        default=None, description="Endzeile der Aenderung (V3)"
    )
    old_code: str | None = Field(default=None, description="Zu ersetzender Code")
    new_code: str = Field(description="Neuer Code")


class StructuredAnswer(BaseModel):
    summary: str = Field(description="Kurze Erklaerung der Aenderung")
    explanation: str | None = Field(default=None, description="Detaillierte Erklaerung")
    changes: list[CodeChange] = Field(
        default_factory=list, description="Liste der Aenderungen"
    )
    risks: list[str] = Field(
        default_factory=list, description="Optionale Risikohinweise"
    )


class AssistResponse(BaseModel):
    status: Literal["ok"]
    mode: WorkMode
    answer: str
    structured: StructuredAnswer | None = Field(
        default=None, description="Strukturierte Antwort fuer V1.1"
    )
    duration_seconds: float
    model_path: str
    model_loaded: bool
    context_summary: dict


class ErrorResponse(BaseModel):
    status: Literal["error"]
    blocker: str
    message: str


class TestStep(BaseModel):
    """V3: Pruefschritt fuer Syntaxpruefung oder Testlauf."""

    type: Literal["syntax_check", "test_command"] = Field(
        description="Art des Pruefschritts"
    )
    command: str | None = Field(
        default=None, description="Testbefehl (bei test_command)"
    )
    description: str = Field(description="Beschreibung des Pruefschritts")


class TestResult(BaseModel):
    """V3: Ergebnis eines Pruefschritts."""

    status: Literal["success", "failed", "warning", "blocked"] = Field(
        description="Status des Pruefschritts"
    )
    message: str = Field(description="Kurze Beschreibung des Ergebnisses")
    stdout: str | None = Field(
        default=None, description="Standardausgabe des Pruefschritts"
    )
    stderr: str | None = Field(
        default=None, description="Fehlerausgabe des Pruefschritts"
    )
    exit_code: int | None = Field(
        default=None, description="Exit-Code des Pruefschritts"
    )


class StructuredAnswerV3(StructuredAnswer):
    """V3: Erweiterte strukturierte Antwort mit Pruefschritten und Ergebnisbewertung."""

    test_step: TestStep | None = Field(
        default=None, description="Empfohlener Pruefschritt"
    )
    test_result: TestResult | None = Field(
        default=None, description="Ergebnis des Pruefschritts"
    )


class V4PlanStep(BaseModel):
    id: str
    title: str
    purpose: str
    status: ExecutionStepStatus = "pending"
    details: str | None = None
    files: list[str] = Field(default_factory=list)


class V4Checkpoint(BaseModel):
    id: str
    title: str
    required: bool
    status: Literal["required", "approved", "skipped"] = "required"
    message: str


class V4Workflow(BaseModel):
    mode: Literal["agent_v4"] = "agent_v4"
    plan: list[V4PlanStep] = Field(default_factory=list)
    relevant_files: list[str] = Field(default_factory=list)
    checkpoints: list[V4Checkpoint] = Field(default_factory=list)
    final_status: WorkflowFinalStatus
    final_message: str
    next_action: str | None = None


class V5AlternativePlan(BaseModel):
    id: str
    title: str
    strategy: str
    risk_level: Literal["low", "medium"]
    steps: list[V4PlanStep] = Field(default_factory=list)
    files: list[str] = Field(default_factory=list)


class V5LabWorkflow(BaseModel):
    mode: Literal["agent_v5_lab"] = "agent_v5_lab"
    experiment_id: str
    experiment_label: str
    lab_enabled: bool
    alternatives: list[V5AlternativePlan] = Field(default_factory=list)
    comparison_summary: str
    final_status: WorkflowFinalStatus
    final_message: str
    next_action: str | None = None


class V6ProductFlow(BaseModel):
    mode: Literal["agent_v6"] = "agent_v6"
    product_label: str
    risk_level: Literal["low", "medium", "high"]
    risk_reasons: list[str] = Field(default_factory=list)
    visible_controls: list[str] = Field(default_factory=list)
    internal_mechanisms: list[str] = Field(default_factory=list)
    final_status: WorkflowFinalStatus
    final_message: str
    next_action: str | None = None


class ProjectAgentFlow(BaseModel):
    mode: Literal["agent_project"] = "agent_project"
    agent_label: str
    autonomy_approved: bool
    allowed_project_root: str | None = None
    steps: list[V4PlanStep] = Field(default_factory=list)
    escalation_type: Literal["none", "external_blocker", "out_of_scope"] = "none"
    escalation_reason: str | None = None
    final_status: WorkflowFinalStatus
    final_message: str
    next_action: str | None = None
