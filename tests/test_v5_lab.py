import unittest
from dataclasses import replace

from backend.config import AppConfig
from backend.schemas import AssistRequest
from backend.v5_lab import build_v5_lab_workflow


class V5LabWorkflowTests(unittest.TestCase):
    def setUp(self) -> None:
        self.base_config = AppConfig(
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
            v5_lab_enabled=False,
        )

    def test_blocks_when_lab_disabled(self) -> None:
        request = AssistRequest(
            prompt="Plane Alternativen",
            mode="agent_v5_lab",
            current_file_path="demo.py",
        )
        workflow = build_v5_lab_workflow(request, self.base_config)
        self.assertEqual(workflow.final_status, "blocked")
        self.assertFalse(workflow.lab_enabled)
        self.assertEqual(len(workflow.alternatives), 0)

    def test_builds_two_distinct_alternatives_when_enabled(self) -> None:
        config = replace(self.base_config, v5_lab_enabled=True)
        request = AssistRequest(
            prompt="Optimiere add Funktion",
            mode="agent_v5_lab",
            current_file_path="demo.py",
            workspace_files=[
                "demo.py",
                "backend/service.py",
                "backend/response_parser.py",
            ],
        )
        workflow = build_v5_lab_workflow(request, config)
        self.assertEqual(workflow.final_status, "successful")
        self.assertTrue(workflow.lab_enabled)
        self.assertGreaterEqual(len(workflow.alternatives), 2)

        first, second = workflow.alternatives[0], workflow.alternatives[1]
        self.assertNotEqual(first.strategy, second.strategy)
        self.assertNotEqual(first.risk_level, second.risk_level)
        self.assertNotEqual(first.title, second.title)


if __name__ == "__main__":
    unittest.main()
