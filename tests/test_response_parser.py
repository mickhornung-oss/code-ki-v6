import unittest

from backend.response_parser import parse_structured_answer


class ResponseParserTests(unittest.TestCase):
    def test_parse_valid_v3_json(self) -> None:
        raw = """
        {
          "summary": "ok",
          "changes": [
            {
              "type": "replace",
              "description": "desc",
              "line_start": 1,
              "line_end": 1,
              "old_code": "a",
              "new_code": "b"
            }
          ],
          "risks": []
        }
        """
        structured, err = parse_structured_answer(raw)
        self.assertEqual(err, "")
        self.assertIsNotNone(structured)
        self.assertEqual(structured.summary, "ok")
        self.assertEqual(len(structured.changes), 1)

    def test_reject_invalid_line_range(self) -> None:
        raw = """
        {
          "summary": "bad",
          "changes": [
            {
              "type": "replace",
              "description": "desc",
              "line_start": 5,
              "line_end": 3,
              "new_code": "x"
            }
          ]
        }
        """
        structured, err = parse_structured_answer(raw)
        self.assertIsNone(structured)
        self.assertIn("Startzeile", err)


if __name__ == "__main__":
    unittest.main()
