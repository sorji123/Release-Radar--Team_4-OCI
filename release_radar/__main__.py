"""Run from the repository root: python -m release_radar demo."""

import argparse
import json
import sys
from pathlib import Path

from .pipeline import ROOT, run_demo


def main() -> int:
    parser = argparse.ArgumentParser(description="Release Radar website and offline development tools")
    commands = parser.add_subparsers(dest="command", required=True)
    demo = commands.add_parser("demo", help="Run synthetic fixtures without cloud credentials")
    demo.add_argument("--data-dir", type=Path, default=ROOT / "data" / "demo")
    demo.add_argument("--customer", default="Northwind Telecom")
    demo.add_argument("--release", default="DEMO")
    demo.add_argument("--top-k", type=int, default=3)
    demo.add_argument("--threshold", type=float, default=0.60)
    demo.add_argument("--output", type=Path, default=Path("build/demo-report.json"))
    site = commands.add_parser("site", help="Start the local website at http://127.0.0.1:8765")
    site.add_argument("--port", type=int, default=8765)
    commands.add_parser("build-site", help="Build browser data and an APEX static-assets ZIP")
    commands.add_parser("check-release", help="Check Oracle's public readiness index for the latest quarter")
    args = parser.parse_args()
    try:
        if args.command != "demo":
            from .site import build_site, check_latest, serve_site
            if args.command == "site":
                serve_site(args.port)
            elif args.command == "build-site":
                print(f"APEX assets: {build_site()}")
            else:
                print(json.dumps(check_latest(), indent=2))
            return 0
        report = run_demo(args.data_dir, args.customer, args.release, args.top_k, args.threshold)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False) + "\n",
                               encoding="utf-8")
    except (ValueError, OSError, KeyError, TypeError) as error:
        print(f"Demo failed: {error}", file=sys.stderr)
        return 1
    print(report["notice"])
    print(json.dumps(report["summary"], indent=2))
    print(f"Report: {args.output.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
