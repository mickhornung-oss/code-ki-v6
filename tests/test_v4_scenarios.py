import unittest

from backend.config import AppConfig
from backend.schemas import AssistRequest, StructuredAnswerV3
from backend.v4_workflow import build_v4_workflow


class V4ScenarioCoverageTests(unittest.TestCase):
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

    def test_scenario_a_analysis_only_successful(self) -> None:
        request = AssistRequest(
            prompt="Analysiere die aktive Datei.",
            mode="agent_v4",
            current_file_path="demo.py",
        )
        structured = StructuredAnswerV3(
            summary="Analyse", explanation=None, changes=[], risks=[]
        )
        workflow = build_v4_workflow(
            request,
            self.config,
            structured=structured,
            parse_error="",
            context_summary={},
        )

        self.assertEqual(workflow.final_status, "successful")
        self.assertEqual(workflow.plan[0].status, "success")
        self.assertEqual(workflow.plan[1].status, "success")
        self.assertEqual(workflow.plan[3].status, "skipped")

    def test_scenario_b_small_change_blocks_on_apply_checkpoint(self) -> None:
        request = AssistRequest(
            prompt="Kleine sichere Aenderung.",
            mode="agent_v4",
            current_file_path="demo.py",
        )
        structured = StructuredAnswerV3(
            summary="Change",
            explanation=None,
            changes=[
                {
                    "type": "replace",
                    "description": "Spacing",
                    "line_start": 2,
                    "line_end": 2,
                    "old_code": "    return a+b",
                    "new_code": "    return a + b",
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
        self.assertEqual(workflow.plan[3].status, "blocked")
        self.assertTrue(any(cp.id == "apply_changes" for cp in workflow.checkpoints))

    def test_scenario_c_multi_step_plan_is_visible(self) -> None:
        request = AssistRequest(
            prompt="Plane mehrere Schritte und pruefe den Ablauf.",
            mode="agent_v4",
            current_file_path="backend/service.py",
            workspace_files=[
                "backend/service.py",
                "backend/response_parser.py",
                "backend/context_builder.py",
            ],
        )
        structured = StructuredAnswerV3(
            summary="Plan", explanation=None, changes=[], risks=[]
        )
        workflow = build_v4_workflow(
            request,
            self.config,
            structured=structured,
            parse_error="",
            context_summary={},
        )

        self.assertEqual(len(workflow.plan), 6)
        self.assertEqual(workflow.plan[0].id, "plan")
        self.assertEqual(workflow.plan[5].id, "evaluation")
        self.assertIn(
            workflow.final_status, {"successful", "partial", "blocked", "failed"}
        )

    def test_scenario_d_controlled_blocking_without_active_file(self) -> None:
        request = AssistRequest(prompt="Mach etwas.", mode="agent_v4")
        structured = StructuredAnswerV3(
            summary="x", explanation=None, changes=[], risks=[]
        )
        workflow = build_v4_workflow(
            request,
            self.config,
            structured=structured,
            parse_error="",
            context_summary={},
        )

        self.assertEqual(workflow.final_status, "blocked")
        self.assertTrue(
            any(cp.id == "require_active_python_file" for cp in workflow.checkpoints)
        )

    def test_scenario_e_partial_when_test_warns(self) -> None:
        request = AssistRequest(
            prompt="Analysiere inkl. Testwarnung",
            mode="agent_v4",
            current_file_path="demo.py",
        )
        structured = StructuredAnswerV3(
            summary="analysis",
            explanation=None,
            changes=[],
            risks=[],
            test_result={
                "status": "warning",
                "message": "Warnung",
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


if __name__ == "__main__":
    unittest.main()
