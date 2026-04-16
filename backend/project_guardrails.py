from __future__ import annotations

import re
from pathlib import Path

from backend.schemas import AssistRequest, StructuredAnswerV3

_EXTERNAL_BLOCKER_PATTERNS = [
    re.compile(r"\bpip\s+install\b", re.IGNORECASE),
    re.compile(r"\bnpm\s+install\b", re.IGNORECASE),
    re.compile(r"\bapt(-get)?\s+install\b", re.IGNORECASE),
    re.compile(r"\bwinget\s+install\b", re.IGNORECASE),
    re.compile(r"\bchoco\s+install\b", re.IGNORECASE),
    re.compile(r"\bcurl\b", re.IGNORECASE),
    re.compile(r"\bwget\b", re.IGNORECASE),
]


def resolve_project_root(workspace_root: str | None) -> str | None:
    root = str(workspace_root or "").strip()
    if not root:
        return None
    try:
        return str(Path(root).resolve())
    except Exception:
        return None


def is_path_within_project(
    candidate_path: str | None, project_root: str | None
) -> bool:
    if not candidate_path or not project_root:
        return False
    try:
        root = Path(project_root).resolve()
        candidate = Path(candidate_path).resolve()
    except Exception:
        return False
    return candidate == root or root in candidate.parents


def validate_request_scope(request: AssistRequest) -> tuple[bool, str]:
    project_root = resolve_project_root(request.workspace_root)
    if not project_root:
        return False, "Kein gueltiger Projektordner (workspace_root) vorhanden."

    scoped_paths: list[str] = []
    if request.current_file_path:
        scoped_paths.append(request.current_file_path)
    for file in request.additional_files:
        scoped_paths.append(file.file_path)
    scoped_paths.extend(request.workspace_files[:50])

    for path in scoped_paths:
        if not is_path_within_project(path, project_root):
            return (
                False,
                f"Pfad ausserhalb des erlaubten Projektordners erkannt: {path}",
            )

    return True, ""


def detect_external_blocker(prompt: str) -> str | None:
    text = str(prompt or "")
    for pattern in _EXTERNAL_BLOCKER_PATTERNS:
        if pattern.search(text):
            return (
                "Externer Eingriff erkannt (Installation/Download). "
                "Dafuer ist eine explizite Nutzerfreigabe erforderlich."
            )
    return None


def detect_out_of_scope_changes(
    structured: StructuredAnswerV3 | None, project_root: str | None
) -> str | None:
    if structured is None or not project_root:
        return None
    for change in structured.changes:
        if change.file_path and not is_path_within_project(
            change.file_path, project_root
        ):
            return (
                f"Vorgeschlagene Aenderung ausserhalb Projektordner: {change.file_path}"
            )
    return None
