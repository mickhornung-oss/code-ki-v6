from __future__ import annotations

import time
from typing import TYPE_CHECKING

from backend.config import AppConfig
from backend.context_builder import build_user_prompt
from backend.project_agent_flow import build_project_agent_flow
from backend.project_guardrails import validate_request_scope
from backend.prompting import build_messages
from backend.response_parser import extract_json_from_text, parse_structured_answer
from backend.schemas import AssistRequest, TestStep
from backend.test_runner import run_test_step
from backend.v4_workflow import build_v4_workflow
from backend.v5_lab import build_v5_lab_workflow
from backend.v6_product_flow import build_v6_product_flow

if TYPE_CHECKING:
    from backend.model_runtime import ModelRuntime


def run_assist(
    request: AssistRequest, *, config: AppConfig, runtime: ModelRuntime
) -> dict:
    if request.mode in {"agent_v6", "agent_project"}:
        in_scope, scope_error = validate_request_scope(request)
        if not in_scope:
            return {
                "status": "ok",
                "mode": request.mode,
                "answer": f"guardrail_blocked: {scope_error}",
                "structured": None,
                "test_step": None,
                "test_result": None,
                "v4_workflow": None,
                "v5_lab_workflow": None,
                "v6_product_flow": None,
                "project_agent_flow": None,
                "duration_seconds": 0.0,
                "model_path": runtime.resolved_model_path,
                "model_loaded": True,
                "context_summary": {
                    "current_file_path": request.current_file_path,
                    "workspace_root": request.workspace_root,
                    "has_file_context": bool(request.current_file_text),
                    "has_selection": bool(request.selected_text),
                    "has_traceback": bool(request.traceback_text),
                    "has_additional_files": bool(request.additional_files),
                    "additional_files_count": len(request.additional_files),
                    "file_chars": len(request.current_file_text or ""),
                    "selection_chars": len(request.selected_text or ""),
                    "traceback_chars": len(request.traceback_text or ""),
                    "workspace_files_count": len(request.workspace_files),
                },
            }

    user_prompt, context_summary = build_user_prompt(request, config)
    messages = build_messages(request, user_prompt)
    started_at = time.perf_counter()
    answer = runtime.complete(messages)
    duration = round(time.perf_counter() - started_at, 3)

    json_text = extract_json_from_text(answer)
    structured, parse_error = parse_structured_answer(json_text)

    if structured and structured.changes and structured.test_step is None:
        test_step = TestStep(
            type="syntax_check",
            description="Python-Syntaxpruefung der vorgeschlagenen Aenderungen",
        )
        structured.test_step = test_step

        candidate_code = structured.changes[0].new_code if structured.changes else None
        if candidate_code and structured.test_result is None:
            structured.test_result = run_test_step(
                test_step=test_step,
                code=candidate_code,
                workspace_root=request.workspace_root,
            )

    structured_dict = structured.model_dump() if structured else None
    test_step_dict = (
        structured.test_step.model_dump()
        if structured and structured.test_step
        else None
    )
    test_result_dict = (
        structured.test_result.model_dump()
        if structured and structured.test_result
        else None
    )
    v4_workflow_dict = None
    v5_lab_workflow_dict = None
    v6_product_flow_dict = None
    project_agent_flow_dict = None
    if request.mode == "agent_v4":
        v4_workflow_dict = build_v4_workflow(
            request,
            config,
            structured=structured,
            parse_error=parse_error,
            context_summary=context_summary,
        ).model_dump()
    elif request.mode == "agent_v5_lab":
        v5_lab_workflow_dict = build_v5_lab_workflow(request, config).model_dump()
    elif request.mode == "agent_v6":
        v6_product_flow_dict = build_v6_product_flow(
            request,
            structured=structured,
            parse_error=parse_error,
        ).model_dump()
    elif request.mode == "agent_project":
        project_agent_flow_dict = build_project_agent_flow(
            request,
            structured=structured,
            parse_error=parse_error,
        ).model_dump()

    return {
        "status": "ok",
        "mode": request.mode,
        "answer": answer,
        "structured": structured_dict,
        "test_step": test_step_dict,
        "test_result": test_result_dict,
        "v4_workflow": v4_workflow_dict,
        "v5_lab_workflow": v5_lab_workflow_dict,
        "v6_product_flow": v6_product_flow_dict,
        "project_agent_flow": project_agent_flow_dict,
        "duration_seconds": duration,
        "model_path": runtime.resolved_model_path,
        "model_loaded": True,
        "context_summary": {
            "current_file_path": context_summary["current_file_path"],
            "workspace_root": context_summary["workspace_root"],
            "has_file_context": context_summary["has_file_context"],
            "has_selection": context_summary["has_selection"],
            "has_traceback": context_summary["has_traceback"],
            "has_additional_files": context_summary["has_additional_files"],
            "additional_files_count": context_summary["additional_files_count"],
            "file_chars": context_summary["file_chars"],
            "selection_chars": context_summary["selection_chars"],
            "traceback_chars": context_summary["traceback_chars"],
            "workspace_files_count": context_summary.get("workspace_files_count", 0),
        },
    }
