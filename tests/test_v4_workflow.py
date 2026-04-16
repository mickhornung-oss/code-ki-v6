import unittest

from backend.config import AppConfig
from backend.schemas import AssistRequest, StructuredAnswerV3
from backend.v4_workflow import build_v4_workflow, select_relevant_files


class V4WorkflowTests(unittest.TestCase):
    def setUp(self) -> None:
        self.config = AppConfig(
            host="127.0.0.1",
            port=8787,
            model_path="C:/fake/model.gguf",
            model_alias="fake",
            n_ctx=1024,
            max_tokens=256,
            temperature=0.2,
            top_p=0.95,
            file_context_max_chars=1000,
            selection_max_chars=1000,
            traceback_max_chars=1000,
            max_additional_files=5,
            max_workspace_files=200,
            v4_file_suggestion_limit=4,
        )

    def test_select_relevant_files_prefers_prompt_matches(self) -> None:
        request = AssistRequest(
            prompt="Refactor parser and service error handling",
            mode="agent_v4",
            current_file_path="backend/service.py",
            workspace_files=[
                "backend/parser_utils.py",
                "backend/response_parser.py",
                "backend/test_runner.py",
                "docs/notes.md",
            ],
        )
        result = select_relevant_files(request, self.config)
        self.assertGreaterEqual(len(result), 1)
        self.assertEqual(result[0], "backend/service.py")
        self.assertIn("backend/response_parser.py", result)

    def test_v4_blocks_at_apply_checkpoint_when_changes_exist(self) -> None:
        request = AssistRequest(
            prompt="Improve add function", mode="agent_v4", current_file_path="demo.py"
        )
        structured = StructuredAnswerV3(
            summary="changes",
            explanation=None,
            changes=[
                {
                    "type": "replace",
                    "description": "fix spacing",
                    "line_start": 2,
                    "line_end": 2,
                    "old_code": "return a+b",
                    "new_code": "return a + b",
                }
            ],
            risks=[],
        )
        workflow = build_v4_workflow(
            request,
            self.config,
            structured=structured,
            parse_error="",
            context_summary={},
        )
        self.assertEqual(workflow.final_status, "blocked")
        self.assertTrue(any(cp.id == "apply_changes" for cp in workflow.checkpoints))

    def test_v4_fails_when_structured_payload_missing(self) -> None:
        request = AssistRequest(
            prompt="Do work", mode="agent_v4", current_file_path="demo.py"
        )
        workflow = build_v4_workflow(
            request,
            self.config,
            structured=None,
            parse_error="invalid json",
            context_summary={},
        )
        self.assertEqual(workflow.final_status, "failed")
        self.assertIn("nicht sicher", workflow.final_message.lower())

    def test_v4_marks_partial_when_test_result_warns(self) -> None:
        request = AssistRequest(
            prompt="Analyze", mode="agent_v4", current_file_path="demo.py"
        )
        structured = StructuredAnswerV3(
            summary="analysis",
            explanation=None,
            changes=[],
            risks=[],
            test_result={
                "status": "warning",
                "message": "warning",
                "stdout": "",
                "stderr": "",
                "exit_code": 0,
            },
        )
        workflow = build_v4_workflow(
            request,
            self.config,
            structured=structured,
            parse_error="",
            context_summary={},
        )
        self.assertEqual(workflow.final_status, "partial")

    def test_v4_blocks_without_active_file(self) -> None:
        request = AssistRequest(prompt="Analyze this", mode="agent_v4")
        workflow = build_v4_workflow(
            request,
            self.config,
            structured=StructuredAnswerV3(
                summary="x", explanation=None, changes=[], risks=[]
            ),
            parse_error="",
            context_summary={},
        )
        self.assertEqual(workflow.final_status, "blocked")
        self.assertIn("keine aktive python-datei", workflow.final_message.lower())
        self.assertTrue(
            any(cp.id == "require_active_python_file" for cp in workflow.checkpoints)
        )

    def test_v4_blocks_for_non_python_active_file(self) -> None:
        request = AssistRequest(
            prompt="Analyze this",
            mode="agent_v4",
            current_file_path="README.md",
        )
        workflow = build_v4_workflow(
            request,
            self.config,
            structured=StructuredAnswerV3(
                summary="x", explanation=None, changes=[], risks=[]
            ),
            parse_error="",
            context_summary={},
        )
        self.assertEqual(workflow.final_status, "blocked")
        self.assertIn("keine python-datei", workflow.final_message.lower())
        self.assertTrue(
            any(cp.id == "require_python_file_type" for cp in workflow.checkpoints)
        )

    def test_v4_plan_has_expected_step_order(self) -> None:
        request = AssistRequest(
            prompt="Nur analysieren",
            mode="agent_v4",
            current_file_path="demo.py",
        )
        workflow = build_v4_workflow(
            request,
            self.config,
            structured=StructuredAnswerV3(
                summary="analysis", explanation=None, changes=[], risks=[]
            ),
            parse_error="",
            context_summary={},
        )
        self.assertEqual(
            [step.id for step in workflow.plan],
            [
                "plan",
                "file_selection",
                "change_proposal",
                "apply_checkpoint",
                "test_step",
                "evaluation",
            ],
        )
        self.assertEqual(workflow.final_status, "successful")


if __name__ == "__main__":
    unittest.main()
