import unittest

from backend.app import health


class AppHealthTests(unittest.TestCase):
    def test_health_payload_returns_expected_shape(self) -> None:
        payload = health()
        self.assertEqual(payload["status"], "ok")
        self.assertIn("service", payload)
        self.assertIn("host", payload)
        self.assertIn("port", payload)
        self.assertIn("model_loaded", payload)


if __name__ == "__main__":
    unittest.main()
