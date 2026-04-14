from __future__ import annotations

from backend.config import AppConfig
from backend.schemas import AssistRequest


def _clip_text(value: str | None, *, max_chars: int) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    if not normalized:
        return None
    if len(normalized) <= max_chars:
        return normalized
    return normalized[:max_chars].rstrip() + "\n...[truncated]"


def build_context_summary(request: AssistRequest, config: AppConfig) -> dict:
    clipped_file = _clip_text(request.current_file_text, max_chars=config.file_context_max_chars)
    clipped_selection = _clip_text(request.selected_text, max_chars=config.selection_max_chars)
    clipped_traceback = _clip_text(request.traceback_text, max_chars=config.traceback_max_chars)
    
    # V2: Zusatzdateien kontrolliert verarbeiten
    additional_files_context = []
    max_files = config.max_additional_files
    for i, file in enumerate(request.additional_files):
        if i >= max_files:
            break
        clipped_content = _clip_text(file.file_text, max_chars=config.file_context_max_chars)
        if clipped_content:
            additional_files_context.append({
                "file_path": file.file_path,
                "description": file.description,
                "content": clipped_content,
                "chars": len(clipped_content)
            })
    
    workspace_files = [str(path).strip() for path in request.workspace_files if str(path).strip()]
    workspace_files = workspace_files[: config.max_workspace_files]

    return {
        "current_file_path": request.current_file_path,
        "workspace_root": request.workspace_root,
        "has_file_context": clipped_file is not None,
        "has_selection": clipped_selection is not None,
        "has_traceback": clipped_traceback is not None,
        "has_additional_files": len(additional_files_context) > 0,
        "additional_files_count": len(additional_files_context),
        "file_chars": len(clipped_file or ""),
        "selection_chars": len(clipped_selection or ""),
        "traceback_chars": len(clipped_traceback or ""),
        "workspace_files_count": len(workspace_files),
        "file_context": clipped_file,
        "selected_text": clipped_selection,
        "traceback_text": clipped_traceback,
        "additional_files": additional_files_context,
        "workspace_files": workspace_files,
    }


def build_user_prompt(request: AssistRequest, config: AppConfig) -> tuple[str, dict]:
    context = build_context_summary(request, config)
    sections: list[str] = []
    sections.append(f"Arbeitsmodus: {request.mode}")
    sections.append(f"Arbeitsauftrag:\n{request.prompt.strip()}")
    if context["current_file_path"]:
        sections.append(f"Aktuelle Datei: {context['current_file_path']}")
    if context["workspace_root"]:
        sections.append(f"Workspace: {context['workspace_root']}")
    if request.mode == "agent_v4" and context["workspace_files_count"] > 0:
        sections.append(
            "Workspace-Dateiindex (begrenzter Auszug):\n"
            + "\n".join(f"- {path}" for path in context["workspace_files"][:20])
        )
    
    # V2: Zusatzdateien kontrolliert in den Prompt einbauen
    if context["has_additional_files"]:
        sections.append(f"Zusatzdateien ({context['additional_files_count']} Dateien):")
        for file in context["additional_files"]:
            desc = f" - {file['description']}" if file["description"] else ""
            sections.append(f"Datei: {file['file_path']}{desc}")
            sections.append(f"```python\n{file['content']}\n```")
    
    if context["traceback_text"]:
        sections.append(f"Traceback / Fehler:\n{context['traceback_text']}")
    if context["selected_text"]:
        sections.append(f"Markierter Bereich:\n```python\n{context['selected_text']}\n```")
    if context["file_context"]:
        sections.append(f"Aktuelle Datei (Kontextauszug):\n```python\n{context['file_context']}\n```")
    return "\n\n".join(sections), context
