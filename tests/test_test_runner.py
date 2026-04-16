import unittest
from pathlib import Path

from backend.test_runner import run_test_command


class TestRunnerSecurityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.workspace_root = str(Path(__file__).resolve().parents[1])

    def test_blocks_non_allowlisted_command(self) -> None:
        result = run_test_command("cmd /c echo hi", workspace_root=self.workspace_root)
        self.assertEqual(result.status, "blocked")
        self.assertIn("Nicht erlaubter Testbefehl", result.stderr)

    def test_allows_python_unittest_module(self) -> None:
        result = run_test_command(
            "python -m unittest -h", workspace_root=self.workspace_root
        )
        self.assertIn(result.status, {"success", "failed", "blocked"})
        self.assertNotIn("Nicht erlaubter Testbefehl", result.stderr or "")


if __name__ == "__main__":
    unittest.main()
