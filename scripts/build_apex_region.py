"""Export APEX region markup and separate Static Application Files."""

import argparse
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
START = "<!-- RELEASE_RADAR_APP_START -->"
END = "<!-- RELEASE_RADAR_APP_END -->"


def build_region(web_dir: Path) -> str:
    page = (web_dir / "index.html").read_text(encoding="utf-8")
    if page.count(START) != 1 or page.count(END) != 1:
        raise ValueError("The page must contain exactly one pair of APEX app markers")
    app = page.split(START, 1)[1].split(END, 1)[0].strip()
    if len(app.encode("utf-8")) > 32767:
        raise ValueError("Region markup exceeds the conservative 32767-byte source limit")
    return app + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "build" / "apex-region.html")
    args = parser.parse_args()
    content = build_region(ROOT / "web")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(content, encoding="utf-8")
    assets = args.output.parent / "apex-static"
    assets.mkdir(parents=True, exist_ok=True)
    for name in ("app.css", "app.js"):
        shutil.copyfile(ROOT / "web" / name, assets / name)
    print(f"APEX Static Content region: {args.output}")
    print(f"Upload Static Application Files from: {assets}")
    print("Set page CSS File URLs to #APP_FILES#app.css and JavaScript File URLs to #APP_FILES#app.js")


if __name__ == "__main__":
    main()
