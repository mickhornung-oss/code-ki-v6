import unittest

from backend.schemas import AssistRequest, StructuredAnswerV3
from backend.v6_product_flow import build_v6_product_flow


class V6ProductFlowTests(unittest.TestCase):
    def test_blocks_without_active_python_file(self) -> None:
        request = AssistRequest(prompt="Analyse", mode="agent_v6")
        flow = build_v6_product_flow(request, structured=None, parse_error="")
        self.assertEqual(flow.final_status, "blocked")
        self.assertEqual(flow.risk_level, "high")

    def test_medium_risk_for_delete_change(self) -> None:
        request = AssistRequest(
            prompt="Delete vorsichtig",
            mode="agent_v6",
            current_file_path="demo.py",
            current_file_text="print('x')\n",
        )
        structured = StructuredAnswerV3(
            summary="Delete",
            changes=[
                {
                    "type": "delete",
                    "description": "Alte Zeile loeschen",
                    "line_start": 1,
                    "line_end": 1,
                    "new_code": "",
                }
            ],
            risks=[],
        )
        flow = build_v6_product_flow(request, structured=structured, parse_error="")
        self.assertEqual(flow.risk_level, "medium")
        self.assertEqual(flow.final_status, "partial")


if __name__ == "__main__":
    unittest.main()
