import unittest

from scripts.build_demo_data import ROOT, build_bootstrap


class BrowserDatasetTests(unittest.TestCase):
    def test_bootstrap_contains_grounded_detail_fields(self):
        payload = build_bootstrap(ROOT / "data" / "demo")
        self.assertEqual(payload["mode"], "FIXTURE")
        self.assertEqual(payload["customers"], ["Northwind Telecom"])
        self.assertEqual(payload["releases"], [{"code": "DEMO", "label": "Demo release"}])
        self.assertEqual(len(payload["report"]["findings"]), 3)
        for finding in payload["report"]["findings"]:
            self.assertEqual(finding["source_kind"], "SYNTHETIC")
            self.assertTrue(finding["object_description"])
            self.assertTrue(finding["module"])
            self.assertIn(finding["cited_text"], finding["feature_description"])
            self.assertNotIn("expected_sev", finding)
            self.assertNotIn("embedding", finding)
        self.assertEqual(payload["runs"][0]["id"], payload["report"]["run_id"])


if __name__ == "__main__":
    unittest.main()
