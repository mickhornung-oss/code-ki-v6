import unittest

from backend.project_agent_flow import build_project_agent_flow
from backend.project_guardrails import is_path_within_project, validate_request_scope
from backend.schemas import AssistRequest, StructuredAnswerV3


class ProjectAgentFlowTests(unittest.TestCase):
    def test_scope_blocks_outside_workspace(self) -> None:
        request = AssistRequest(
            prompt="Analyse",
            mode="agent_project",
            workspace_root="C:/repo",
            current_file_path="C:/other/file.py",
        )
        ok, reason = validate_request_scope(request)
        self.assertFalse(ok)
        self.assertIn("ausserhalb", reason)

    def test_agent_requires_autonomy_approval(self) -> None:
        request = AssistRequest(
            prompt="Verbessere demo.py",
            mode="agent_project",
            workspace_root="C:/repo",
            current_file_path="C:/repo/demo.py",
            agent_control={"autonomy_approved": False},
        )
        flow = build_project_agent_flow(request, structured=None, parse_error="")
        self.assertEqual(flow.final_status, "blocked")
        self.assertFalse(flow.autonomy_approved)

    def test_agent_blocks_external_install_prompt(self) -> None:
        request = AssistRequest(
            prompt="Bitte pip install requests und danach Code anpassen",
            mode="agent_project",
            workspace_root="C:/repo",
            current_file_path="C:/repo/demo.py",
            agent_control={"autonomy_approved": True},
        )
        structured = StructuredAnswerV3(summary="x", changes=[], risks=[])
        flow = build_project_agent_flow(request, structured=structured, parse_error="")
        self.assertEqual(flow.escalation_type, "external_blocker")
        self.assertEqual(flow.final_status, "blocked")

    def test_path_within_project(self) -> None:
        self.assertTrue(is_path_within_project("C:/repo/a.py", "C:/repo"))
        self.assertFalse(is_path_within_project("C:/repo2/a.py", "C:/repo"))

    def test_workspace_analysis_without_active_file_is_allowed(self) -> None:
        request = AssistRequest(
            prompt="Analysiere das gesamte Projekt und gib einen Architekturueberblick",
            mode="agent_project",
            workspace_root="C:/repo",
            workspace_files=["C:/repo/a.py", "C:/repo/b.py"],
            agent_control={"autonomy_approved": True},
        )
        structured = StructuredAnswerV3(summary="Analyse", changes=[], risks=[])
        flow = build_project_agent_flow(request, structured=structured, parse_error="")
        self.assertEqual(flow.final_status, "successful")
        self.assertEqual(flow.escalation_type, "none")

    def test_change_without_active_file_and_without_target_path_stays_blocked(
        self,
    ) -> None:
        request = AssistRequest(
            prompt="Aendere den Code im Projekt",
            mode="agent_project",
            workspace_root="C:/repo",
            workspace_files=["C:/repo/a.py"],
            agent_control={"autonomy_approved": True},
        )
        structured = StructuredAnswerV3(
            summary="Aenderung",
            changes=[
                {
                    "type": "replace",
                    "description": "Unscharfe Aenderung",
                    "line_start": 1,
                    "line_end": 1,
                    "new_code": "print('ok')",
                }
            ],
            risks=[],
        )
        flow = build_project_agent_flow(request, structured=structured, parse_error="")
        self.assertEqual(flow.final_status, "blocked")
        self.assertIn("dateiunscharfe", flow.final_message.lower())


if __name__ == "__main__":
    unittest.main()
