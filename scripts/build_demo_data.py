"""Build a browser-safe prepared dataset from the tested synthetic pipeline."""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from release_radar.pipeline import read_json, run_demo  # noqa: E402


def build_bootstrap(data_dir: Path) -> dict:
    report = run_demo(data_dir)
    objects = {row["object_key"]: row for row in read_json(data_dir / "config_objects.json")
               if row["customer"] == report["customer"]}
    features = {row["feature_key"]: row for row in read_json(data_dir / "release_features.json")
                if row["release_code"] == report["release_code"]}
    # Select individual presentation fields rather than exporting raw input rows.
    for finding in report["findings"]:
        obj = objects[finding["object_key"]]
        feature = features[finding["feature_key"]]
        finding.update(
            module=obj["module"], object_description=obj["description"],
            feature_description=feature["description"], opt_in=feature["opt_in"],
        )
    return {
        "schema_version": 1,
        "mode": "FIXTURE",
        "notice": report["notice"],
        "customers": [report["customer"]],
        "releases": [{"code": "DEMO", "label": "Demo release"}],
        "runs": [{"id": report["run_id"], "status": report["status"],
                  "started_at": report["started_at"], "customer": report["customer"],
                  "release_code": report["release_code"], "summary": report["summary"]}],
        "report": report,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "web" / "demo-data.json")
    args = parser.parse_args()
    bootstrap = build_bootstrap(ROOT / "data" / "demo")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(bootstrap, indent=2, ensure_ascii=False, allow_nan=False) + "\n",
                           encoding="utf-8")
    print(f"Prepared {len(bootstrap['report']['findings'])} findings: {args.output}")


if __name__ == "__main__":
    main()
