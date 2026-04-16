import unittest
from dataclasses import replace

from backend.config import AppConfig
from backend.schemas import AssistRequest
from backend.service import run_assist


class _FakeRuntime:
    def __init__(self, answer: str) -> None:
        self._answer = answer
        self.resolved_model_path = "C:/fake/model.gguf"

    def complete(self, messages: list[dict]) -> str:  # noqa: ARG002
        return self._answer


class ServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.config = AppConfig(
            host="127.0.0.1",
            port=8787,
            model_path="C:/fake/model.gguf",
            model_alias="fake",
            n_ctx=512,
            max_tokens=128,
            temperature=0.2,
            top_p=0.95,
            file_context_max_chars=1000,
            selection_max_chars=1000,
            traceback_max_chars=1000,
            max_additional_files=5,
            max_workspace_files=200,
            v4_file_suggestion_limit=6,
        )

    def test_run_assist_returns_structured_payload_and_test_result(self) -> None:
        runtime = _FakeRuntime("""
            {
              "summary": "Fix return spacing",
              "changes": [
                {
                  "type": "replace",
                  "description": "format return",
                  "line_start": 2,
                  "line_end": 2,
                  "old_code": "    return a+b",
                  "new_code": "def add(a, b):\\n    return a + b\\n"
                }
              ],
              "risks": []
            }
            """)
        request = AssistRequest(
            prompt="Improve function",
            mode="rewrite",
            current_file_path="demo.py",
            current_file_text="def add(a,b):\n    return a+b\n",
            selected_text="def add(a,b):\n    return a+b\n",
            workspace_root="C:/repo",
            traceback_text="",
        )

        result = run_assist(request, config=self.config, runtime=runtime)
        self.assertEqual(result["status"], "ok")
        self.assertIsNotNone(result["structured"])
        self.assertEqual(result["structured"]["summary"], "Fix return spacing")
        self.assertEqual(result["test_step"]["type"], "syntax_check")
        self.assertIn(result["test_result"]["status"], {"success", "failed", "blocked"})

    def test_run_assist_falls_back_when_response_not_structured(self) -> None:
        runtime = _FakeRuntime("plain text answer")
        request = AssistRequest(prompt="Explain", mode="explain")

        result = run_assist(request, config=self.config, runtime=runtime)
        self.assertEqual(result["status"], "ok")
        self.assertIsNone(result["structured"])
        self.assertIsNone(result["test_step"])
        self.assertIsNone(result["test_result"])

    def test_run_assist_v4_returns_workflow(self) -> None:
        runtime = _FakeRuntime("""
            {
              "summary": "Plan generated",
              "changes": [],
              "risks": []
            }
            """)
        request = AssistRequest(
            prompt="Analyze and explain this file",
            mode="agent_v4",
            current_file_path="backend/service.py",
            workspace_files=[
                "backend/service.py",
                "backend/response_parser.py",
                "README.md",
            ],
            v4_control={
                "continue_after_plan": True,
                "continue_after_file_selection": True,
            },
        )
        result = run_assist(request, config=self.config, runtime=runtime)
        self.assertEqual(result["status"], "ok")
        self.assertIsNotNone(result["v4_workflow"])
        self.assertIn(
            result["v4_workflow"]["final_status"],
            {"successful", "partial", "failed", "blocked"},
        )

    def test_run_assist_v4_blocks_without_active_python_file(self) -> None:
        runtime = _FakeRuntime("""
            {
              "summary": "Plan generated",
              "changes": [],
              "risks": []
            }
            """)
        request = AssistRequest(
            prompt="Analyze the active file",
            mode="agent_v4",
        )
        result = run_assist(request, config=self.config, runtime=runtime)
        self.assertEqual(result["status"], "ok")
        self.assertIsNotNone(result["v4_workflow"])
        self.assertEqual(result["v4_workflow"]["final_status"], "blocked")
        self.assertIn(
            "keine aktive python-datei", result["v4_workflow"]["final_message"].lower()
        )

    def test_run_assist_v5_lab_returns_alternatives_when_enabled(self) -> None:
        runtime = _FakeRuntime("""
            {
              "summary": "Lab response",
              "changes": [],
              "risks": []
            }
            """)
        request = AssistRequest(
            prompt="Erzeuge alternative Plaene",
            mode="agent_v5_lab",
            current_file_path="demo.py",
            workspace_files=["demo.py", "backend/service.py"],
        )
        config = replace(self.config, v5_lab_enabled=True)
        result = run_assist(request, config=config, runtime=runtime)

        self.assertEqual(result["status"], "ok")
        self.assertIsNotNone(result["v5_lab_workflow"])
        self.assertEqual(result["v5_lab_workflow"]["final_status"], "successful")
        self.assertGreaterEqual(len(result["v5_lab_workflow"]["alternatives"]), 2)

    def test_run_assist_v6_returns_compact_success_for_simple_case(self) -> None:
        runtime = _FakeRuntime("""
            {
              "summary": "Nur Analyse",
              "changes": [],
              "risks": []
            }
            """)
        request = AssistRequest(
            prompt="Erklaere kurz diese Funktion",
            mode="agent_v6",
            current_file_path="C:/repo/demo.py",
            current_file_text="def add(a,b):\n    return a+b\n",
            workspace_root="C:/repo",
        )
        result = run_assist(request, config=self.config, runtime=runtime)

        self.assertEqual(result["status"], "ok")
        self.assertIsNotNone(result["v6_product_flow"])
        self.assertEqual(result["v6_product_flow"]["risk_level"], "low")
        self.assertEqual(result["v6_product_flow"]["final_status"], "successful")

    def test_run_assist_v6_shows_risk_notice_for_multi_file_changes(self) -> None:
        runtime = _FakeRuntime("""
            {
              "summary": "Mehrdatei-Vorschlag",
              "changes": [
                {
                  "type": "replace",
                  "description": "Aenderung in aktiver Datei",
                  "line_start": 1,
                  "line_end": 1,
                  "new_code": "print('ok')"
                },
                {
                  "type": "replace",
                  "description": "Aenderung in Service",
                  "file_path": "backend/service.py",
                  "line_start": 1,
                  "line_end": 1,
                  "new_code": "from __future__ import annotations"
                }
              ],
              "risks": []
            }
            """)
        request = AssistRequest(
            prompt="Aendere zwei Dateien",
            mode="agent_v6",
            current_file_path="C:/repo/demo.py",
            current_file_text="print('x')\n",
            workspace_root="C:/repo",
        )
        result = run_assist(request, config=self.config, runtime=runtime)

        self.assertEqual(result["status"], "ok")
        self.assertIsNotNone(result["v6_product_flow"])
        self.assertEqual(result["v6_product_flow"]["risk_level"], "high")
        self.assertIn(
            "review_before_apply", result["v6_product_flow"]["visible_controls"]
        )
        self.assertEqual(result["v6_product_flow"]["final_status"], "partial")

    def test_run_assist_project_agent_returns_flow(self) -> None:
        runtime = _FakeRuntime("""
            {
              "summary": "Projektagent Vorschlag",
              "changes": [
                {
                  "type": "replace",
                  "description": "Kleine Aenderung",
                  "line_start": 1,
                  "line_end": 1,
                  "new_code": "print('ok')"
                }
              ],
              "risks": []
            }
            """)
        request = AssistRequest(
            prompt="Verbessere die aktive Datei",
            mode="agent_project",
            current_file_path="C:/repo/demo.py",
            current_file_text="print('x')\n",
            workspace_root="C:/repo",
            agent_control={"autonomy_approved": True},
        )
        result = run_assist(request, config=self.config, runtime=runtime)
        self.assertEqual(result["status"], "ok")
        self.assertIsNotNone(result["project_agent_flow"])
        self.assertIn(
            result["project_agent_flow"]["final_status"],
            {"successful", "partial", "blocked", "failed"},
        )


if __name__ == "__main__":
    unittest.main()
