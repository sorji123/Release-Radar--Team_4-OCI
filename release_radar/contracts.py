"""Validate input data and untrusted classifier responses before accepting them."""

import json
import math
from typing import Any
from urllib.parse import urlparse

SEVERITIES = ("BREAKING", "TEST", "OPPORTUNITY", "NONE")
OBJECT_TYPES = ("GROOVY", "APP_COMPOSER", "PAGE_COMPOSER", "WORKFLOW", "OIC", "REPORT")


def _unique_keys(pairs: list[tuple[str, Any]]) -> dict:
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"Duplicate JSON key: {key}")
        result[key] = value
    return result


def parse_json(text: str) -> Any:
    def reject_constant(value: str) -> None:
        raise ValueError(f"Non-finite JSON number: {value}")

    return json.loads(text, object_pairs_hook=_unique_keys, parse_constant=reject_constant)


def require_text(record: dict, key: str) -> str:
    value = record.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{key} must be non-empty text")
    return value


def validate_dataset(features: list[dict], objects: list[dict]) -> None:
    for rows, key, fields in (
        (features, "feature_key", ("release_code", "module", "title", "description", "source_url")),
        (objects, "object_key", ("customer", "object_type", "name", "module", "description")),
    ):
        if not isinstance(rows, list) or not rows:
            raise ValueError("Datasets must be non-empty lists")
        seen = set()
        for row in rows:
            if not isinstance(row, dict):
                raise ValueError("Each dataset row must be an object")
            row_key = require_text(row, key)
            for field in fields:
                require_text(row, field)
            scoped_key = (row[fields[0]], row_key)
            if scoped_key in seen:
                raise ValueError(f"Duplicate {key} within {fields[0]}: {row_key}")
            seen.add(scoped_key)
    for feature in features:
        if feature.get("opt_in") not in ("Y", "N"):
            raise ValueError("opt_in must be Y or N")
        if feature.get("source_kind") not in ("SYNTHETIC", "ORACLE"):
            raise ValueError("source_kind must be SYNTHETIC or ORACLE")
        url = urlparse(feature["source_url"])
        if url.scheme != "https" or not url.hostname:
            raise ValueError("source_url must be an absolute HTTPS URL")
        if feature["source_kind"] == "ORACLE" and not (
            url.hostname == "oracle.com" or url.hostname.endswith(".oracle.com")
        ):
            raise ValueError("ORACLE source_url must point to oracle.com")
    for obj in objects:
        if obj["object_type"] not in OBJECT_TYPES:
            raise ValueError(f"Unsupported object_type: {obj['object_type']}")
        if not isinstance(obj.get("snippet", ""), str):
            raise ValueError("snippet must be text")


def validate_response(raw: str, feature: dict) -> dict:
    """Reject prose, invalid categories, invented evidence, and incomplete tests.

    Structural checks cannot establish the semantic truth of a model's verdict.
    NONE may use an empty citation and a null test_case.
    """
    result = parse_json(raw)
    if not isinstance(result, dict):
        raise ValueError("Classifier response must be a JSON object")
    severity = result.get("severity")
    if severity not in SEVERITIES:
        raise ValueError("Unsupported severity")
    confidence = result.get("confidence")
    if (
        isinstance(confidence, bool)
        or not isinstance(confidence, (int, float))
        or not math.isfinite(confidence)
        or not 0 <= confidence <= 100
    ):
        raise ValueError("confidence must be a finite number between 0 and 100")
    require_text(result, "rationale")
    citation = result.get("cited_text")
    if not isinstance(citation, str):
        raise ValueError("cited_text must be text")
    if severity != "NONE" and not citation.strip():
        raise ValueError("Findings require a citation")
    if citation and not any(citation in feature[field] for field in ("title", "description")):
        raise ValueError("Citation does not appear verbatim in the release feature")
    if severity == "OPPORTUNITY" and feature["opt_in"] != "Y":
        raise ValueError("OPPORTUNITY requires the source opt_in flag to be Y")
    if "test_case" not in result:
        raise ValueError("test_case is required (null is allowed for NONE)")
    test_case = result["test_case"]
    if severity != "NONE" or test_case is not None:
        if not isinstance(test_case, dict):
            raise ValueError("A finding requires a test_case object")
        require_text(test_case, "title")
        require_text(test_case, "expected")
        steps = test_case.get("steps")
        if not isinstance(steps, list) or not steps or any(
            not isinstance(step, str) or not step.strip() for step in steps
        ):
            raise ValueError("test_case.steps must contain non-empty strings")
    return {key: result[key] for key in (
        "severity", "confidence", "rationale", "cited_text", "test_case"
    )}
