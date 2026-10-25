import copy
import json
import math
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from release_radar.contracts import parse_json, validate_dataset, validate_response
from release_radar.pipeline import (
    ROOT, FixtureClassifier, build_prompt, cosine_distance, read_json, run_demo,
    select_candidates,
)

DATA = ROOT / "data" / "demo"


class FixtureFlowTests(unittest.TestCase):
    def test_demo_covers_expected_outcomes_and_counts(self):
        report = run_demo(DATA)
        self.assertEqual(report["mode"], "FIXTURE")
        self.assertEqual(report["summary"], {
            "objects_checked": 6, "release_features": 4, "candidate_pairs": 4,
            "findings_by_severity": {"BREAKING": 1, "TEST": 1, "OPPORTUNITY": 1},
            "objects_with_findings": 3, "objects_without_findings": 3,
        })
        observed = {key: "NONE" for key in read_json(DATA / "expected.json")}
        for finding in report["findings"]:
            observed[finding["object_key"]] = finding["severity"]
        self.assertEqual(observed, read_json(DATA / "expected.json"))
        self.assertEqual([row["severity"] for row in report["findings"]],
                         ["BREAKING", "TEST", "OPPORTUNITY"])
        self.assertEqual(report["decisions"][-1]["severity"], "NONE")

    def test_ground_truth_is_not_required_to_run(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp) / "demo"
            shutil.copytree(DATA, directory)
            (directory / "expected.json").unlink()
            self.assertEqual(len(run_demo(directory)["findings"]), 3)

    def test_keys_can_repeat_across_scopes_without_reusing_vectors(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp) / "demo"
            shutil.copytree(DATA, directory)
            features = read_json(directory / "release_features.json")
            objects = read_json(directory / "config_objects.json")
            vectors = read_json(directory / "embeddings.json")
            features.append({**features[0], "release_code": "OTHER"})
            objects.append({**objects[0], "customer": "Other Customer"})
            vectors["features"]["OTHER"] = {features[0]["feature_key"]: [-1, 0, 0, 0]}
            vectors["objects"]["Other Customer"] = {objects[0]["object_key"]: [0, 0, 0, 1]}
            for name, value in (("release_features", features), ("config_objects", objects),
                                ("embeddings", vectors)):
                (directory / f"{name}.json").write_text(json.dumps(value), encoding="utf-8")
            self.assertEqual(len(run_demo(directory)["findings"]), 3)
            self.assertEqual(run_demo(directory, release="OTHER")["findings"], [])
            self.assertEqual(run_demo(directory, customer="Other Customer")["findings"], [])

    def test_unknown_customer_or_release_fails(self):
        for options in ({"customer": "Unknown"}, {"release": "26D"}):
            with self.subTest(options=options), self.assertRaisesRegex(ValueError, "No data"):
                run_demo(DATA, **options)

    def test_fixture_mode_rejects_real_release_data(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp) / "demo"
            shutil.copytree(DATA, directory)
            features = read_json(directory / "release_features.json")
            features[0].update(source_kind="ORACLE", source_url="https://docs.oracle.com/example")
            (directory / "release_features.json").write_text(json.dumps(features), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "synthetic"):
                run_demo(directory)

    def test_cli_writes_report_and_failure_returns_nonzero(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / "report.json"
            command = [sys.executable, "-m", "release_radar", "demo", "--output", str(output)]
            result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(read_json(output)["status"], "COMPLETED")
            before = output.read_bytes()
            result = subprocess.run(command + ["--release", "UNKNOWN"], cwd=ROOT,
                                    capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("No data", result.stderr)
            self.assertEqual(output.read_bytes(), before)


class MatchingTests(unittest.TestCase):
    def test_module_release_threshold_and_stable_top_k(self):
        obj = {"object_key": "object", "module": "Sales", "customer": "Customer"}
        features = [
            {"feature_key": key, "module": module, "release_code": release}
            for key, module, release in [
                ("b", "Sales", "DEMO"), ("a", "Sales", "DEMO"),
                ("other-module", "HCM", "DEMO"), ("other-release", "Sales", "OLD"),
                ("orthogonal", "Sales", "DEMO"),
            ]
        ]
        vectors = {"objects": {"Customer": {"object": [1, 0]}}, "features": {"DEMO": {
            row["feature_key"]: [1, 0] for row in features
        }}}
        vectors["features"]["DEMO"]["orthogonal"] = [0, 1]
        candidates = select_candidates(obj, features, vectors, "DEMO", top_k=1)
        self.assertEqual([row[1]["feature_key"] for row in candidates], ["a"])
        candidates = select_candidates(obj, features, vectors, "DEMO", threshold=1.0)
        self.assertEqual([row[1]["feature_key"] for row in candidates], ["a", "b"])

    def test_cosine_distances_and_invalid_vectors(self):
        self.assertAlmostEqual(cosine_distance([1, 0], [1, 0]), 0)
        self.assertAlmostEqual(cosine_distance([1, 0], [0, 1]), 1)
        self.assertAlmostEqual(cosine_distance([1, 0], [-1, 0]), 2)
        for vector in ([], [1], [0, 0], [math.nan, 0], [math.inf, 0], [True, 0], ["1", 0]):
            with self.subTest(vector=vector), self.assertRaises(ValueError):
                cosine_distance([1, 0], vector)

    def test_invalid_settings_fail(self):
        for options in ({"top_k": 0}, {"top_k": -1}, {"threshold": 0},
                        {"threshold": 2.1}, {"threshold": math.nan}):
            with self.subTest(options=options), self.assertRaises(ValueError):
                run_demo(DATA, **options)

    def test_missing_fixture_response_is_not_silently_none(self):
        with self.assertRaisesRegex(ValueError, "No fixture response"):
            FixtureClassifier({}).classify({"object_key": "a", "customer": "Customer"},
                                           {"feature_key": "b", "release_code": "DEMO"})

    def test_fixture_responses_are_scoped_by_customer_and_release(self):
        classifier = FixtureClassifier({"A": {"R1": {"a|b": {"severity": "NONE"}}}})
        for customer, release in (("B", "R1"), ("A", "R2")):
            with self.subTest(customer=customer, release=release), self.assertRaises(ValueError):
                classifier.classify({"object_key": "a", "customer": customer},
                                    {"feature_key": "b", "release_code": release})


class ContractTests(unittest.TestCase):
    def setUp(self):
        self.feature = read_json(DATA / "release_features.json")[0]
        self.verdict = read_json(DATA / "responses.json")["Northwind Telecom"]["DEMO"]["nw-account-sync|demo-account-api"]

    def test_valid_response(self):
        self.assertEqual(validate_response(json.dumps(self.verdict), self.feature), self.verdict)

    def test_invented_or_empty_citation_rejected(self):
        for citation in ("Oracle guarantees this will work", "", "   "):
            self.verdict["cited_text"] = citation
            with self.subTest(citation=citation), self.assertRaises(ValueError):
                validate_response(json.dumps(self.verdict), self.feature)

    def test_invalid_confidence_or_category_rejected(self):
        for field, value in [("confidence", -1), ("confidence", 101), ("confidence", True),
                             ("confidence", "99"), ("confidence", math.nan),
                             ("severity", "CRITICAL")]:
            verdict = {**self.verdict, field: value}
            with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                validate_response(json.dumps(verdict), self.feature)

    def test_opportunity_requires_explicit_opt_in(self):
        self.verdict["severity"] = "OPPORTUNITY"
        with self.assertRaisesRegex(ValueError, "opt_in"):
            validate_response(json.dumps(self.verdict), self.feature)

    def test_findings_require_actionable_test(self):
        for test in (None, {}, {"title": "Test", "steps": [], "expected": "Works"},
                     {"title": "Test", "steps": [""], "expected": "Works"}):
            self.verdict["test_case"] = test
            with self.subTest(test=test), self.assertRaises(ValueError):
                validate_response(json.dumps(self.verdict), self.feature)

    def test_none_allows_no_evidence_or_test(self):
        verdict = {**self.verdict, "severity": "NONE", "cited_text": "", "test_case": None}
        self.assertEqual(validate_response(json.dumps(verdict), self.feature)["severity"], "NONE")

    def test_json_prose_duplicates_and_nonfinite_numbers_rejected(self):
        for text in ('```json\n{}\n```', 'Here is a result: {}', '{"x":1,"x":2}',
                     '{"confidence":NaN}'):
            with self.subTest(text=text), self.assertRaises(ValueError):
                parse_json(text)

    def test_prompt_does_not_leak_ground_truth(self):
        config = read_json(DATA / "config_objects.json")[0]
        config["expected_sev"] = "SECRET_EVALUATION_LABEL"
        prompt = build_prompt(config, self.feature)
        self.assertNotIn("SECRET_EVALUATION_LABEL", prompt)
        self.assertIn(config["snippet"], prompt)
        self.assertIn(self.feature["description"], prompt)
        self.assertNotIn("$feature", prompt)

    def test_duplicate_ids_and_invalid_provenance_rejected(self):
        features = read_json(DATA / "release_features.json")
        objects = read_json(DATA / "config_objects.json")
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            validate_dataset(features + [features[0]], objects)
        forged = copy.deepcopy(features)
        forged[0].update(source_kind="ORACLE", source_url="https://oracle.com.example.invalid/item")
        with self.assertRaisesRegex(ValueError, "oracle.com"):
            validate_dataset(forged, objects)


if __name__ == "__main__":
    unittest.main()
