"""Small, replaceable pipeline components for fixture-based development."""

import json
import math
from datetime import datetime, timezone
from pathlib import Path
from string import Template
from typing import Protocol
from uuid import uuid4

from .contracts import SEVERITIES, parse_json, validate_dataset, validate_response

ROOT = Path(__file__).resolve().parent.parent
PROMPT_VERSION = "impact-v1"


class Classifier(Protocol):
    def classify(self, config: dict, feature: dict) -> str: ...


def read_json(path: Path):
    return parse_json(path.read_text(encoding="utf-8"))


def build_prompt(config: dict, feature: dict) -> str:
    """Whitelist source fields; evaluation labels and fixture vectors never enter prompts."""
    template = Template((ROOT / "prompts" / "classify.txt").read_text(encoding="utf-8"))
    return template.substitute(
        feature=json.dumps({key: feature[key] for key in (
            "release_code", "module", "opt_in", "title", "description"
        )}, ensure_ascii=False),
        config=json.dumps({key: config.get(key, "") for key in (
            "object_type", "name", "description", "snippet"
        )}, ensure_ascii=False),
    )


def cosine_distance(left: list, right: list) -> float:
    if not isinstance(left, list) or not isinstance(right, list) or not left or len(left) != len(right):
        raise ValueError("Vectors must be non-empty lists of the same dimension")
    if any(isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value)
           for value in left + right):
        raise ValueError("Vector components must be finite numbers")
    left_norm, right_norm = math.hypot(*left), math.hypot(*right)
    if not left_norm or not right_norm or not math.isfinite(left_norm + right_norm):
        raise ValueError("Vector norms must be finite and non-zero")
    similarity = sum((a / left_norm) * (b / right_norm) for a, b in zip(left, right))
    return max(0.0, min(2.0, 1.0 - similarity))


def select_candidates(config: dict, features: list[dict], vectors: dict,
                      release: str, top_k: int = 3, threshold: float = 0.60) -> list[tuple]:
    if isinstance(top_k, bool) or not isinstance(top_k, int) or top_k < 1:
        raise ValueError("top_k must be a positive integer")
    if not math.isfinite(threshold) or not 0 < threshold <= 2:
        raise ValueError("threshold must be greater than 0 and at most 2")
    matches = []
    for feature in features:
        if feature["module"] != config["module"] or feature["release_code"] != release:
            continue
        distance = cosine_distance(vectors["objects"][config["customer"]][config["object_key"]],
                                   vectors["features"][release][feature["feature_key"]])
        if distance < threshold:
            matches.append((distance, feature))
    return sorted(matches, key=lambda match: (match[0], match[1]["feature_key"]))[:top_k]


class FixtureClassifier:
    """Return authored responses, not AI predictions. Missing pairs fail explicitly."""

    def __init__(self, responses: dict):
        self.responses = responses

    def classify(self, config: dict, feature: dict) -> str:
        key = f"{config['object_key']}|{feature['feature_key']}"
        scope = self.responses.get(config["customer"], {}).get(feature["release_code"], {})
        if key not in scope:
            raise ValueError(f"No fixture response for candidate {key}")
        return json.dumps(scope[key], allow_nan=False)


def run_demo(data_dir: Path, customer: str = "Northwind Telecom", release: str = "DEMO",
             top_k: int = 3, threshold: float = 0.60) -> dict:
    features = read_json(data_dir / "release_features.json")
    objects = read_json(data_dir / "config_objects.json")
    validate_dataset(features, objects)
    if any(feature["source_kind"] != "SYNTHETIC" for feature in features):
        raise ValueError("Fixture mode accepts synthetic release data only")
    features = [feature for feature in features if feature["release_code"] == release]
    objects = [obj for obj in objects if obj["customer"] == customer]
    if not features or not objects:
        raise ValueError("No data for the selected customer or release")
    vectors = read_json(data_dir / "embeddings.json")
    classifier: Classifier = FixtureClassifier(read_json(data_dir / "responses.json"))
    decisions = []
    started_at = datetime.now(timezone.utc).isoformat()
    for config in objects:
        for distance, feature in select_candidates(config, features, vectors, release, top_k, threshold):
            verdict = validate_response(classifier.classify(config, feature), feature)
            decisions.append({
                "object_key": config["object_key"], "object_name": config["name"],
                "object_type": config["object_type"], "snippet": config.get("snippet", ""),
                "feature_key": feature["feature_key"], "feature_title": feature["title"],
                "source_url": feature["source_url"], "source_kind": feature["source_kind"],
                "distance": round(distance, 8), **verdict,
            })
    decisions.sort(key=lambda row: (SEVERITIES.index(row["severity"]), row["object_key"], row["feature_key"]))
    findings = [row for row in decisions if row["severity"] != "NONE"]
    affected = {row["object_key"] for row in findings}
    return {
        "schema_version": 1, "run_id": str(uuid4()), "status": "COMPLETED", "mode": "FIXTURE",
        "notice": "Synthetic data, hand-authored vectors and responses. Not Oracle release guidance or AI accuracy results.",
        "customer": customer, "release_code": release, "prompt_version": PROMPT_VERSION,
        "embedding_model": "fixture-4d", "chat_model": "fixture-responses",
        "top_k": top_k, "threshold": threshold, "started_at": started_at,
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "objects_checked": len(objects), "release_features": len(features),
            "candidate_pairs": len(decisions),
            "findings_by_severity": {severity: sum(row["severity"] == severity for row in findings)
                                     for severity in SEVERITIES if severity != "NONE"},
            "objects_with_findings": len(affected),
            "objects_without_findings": len(objects) - len(affected),
        },
        "findings": findings, "decisions": decisions,
    }
