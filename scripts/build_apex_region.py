"""Bundle the tested dashboard into an APEX Static Content region."""

import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
START = "<!-- RELEASE_RADAR_APP_START -->"
END = "<!-- RELEASE_RADAR_APP_END -->"


def build_region(web_dir: Path) -> str:
    page = (web_dir / "index.html").read_text(encoding="utf-8")
    if page.count(START) != 1 or page.count(END) != 1:
        raise ValueError("The page must contain exactly one pair of APEX app markers")
    app = page.split(START, 1)[1].split(END, 1)[0].strip()
    css = (web_dir / "app.css").read_text(encoding="utf-8")
    javascript = (web_dir / "app.js").read_text(encoding="utf-8")
    if "</style" in css.lower() or "</script" in javascript.lower():
        raise ValueError("Inline bundle contains an unsafe closing tag")
    return f"<style>\n{css}\n</style>\n{app}\n<script>\n{javascript}\n</script>\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "build" / "apex-region.html")
    args = parser.parse_args()
    content = build_region(ROOT / "web")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(content, encoding="utf-8")
    print(f"APEX Static Content region: {args.output}")


if __name__ == "__main__":
    main()
