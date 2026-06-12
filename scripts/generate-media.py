#!/usr/bin/env python3
import json
import os
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".heic"}
VIDEO_EXTS = {".mp4", ".webm", ".mov", ".m4v"}


def scan_folder(folder: str, extensions: set[str]) -> list[dict]:
    items = []
    target = ROOT / folder

    if not target.is_dir():
        return items

    for path in target.iterdir():
        if not path.is_file() or path.name.startswith("."):
            continue

        if path.suffix.lower() not in extensions:
            continue

        items.append(
            {
                "src": f"{folder}/{path.name}",
                "name": path.stem,
                "modified": int(path.stat().st_mtime),
            }
        )

    items.sort(key=lambda item: item["modified"], reverse=True)
    return items


def main() -> None:
    data = {
        "photos": scan_folder("shots", IMAGE_EXTS),
        "videos": scan_folder("videos", VIDEO_EXTS),
    }

    output = ROOT / "media.json"
    output.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Updated {output}")


if __name__ == "__main__":
    main()
