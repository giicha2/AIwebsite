#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROJECTS_DIR = ROOT / "projects"
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".heic"}
VIDEO_EXTS = {".mp4", ".webm", ".mov", ".m4v"}
PREFERRED_VIDEOS = ["cover.mp4", "cover.webm", "cover.mov"]
PREFERRED_IMAGES = ["cover.jpg", "cover.jpeg", "cover.png", "cover.webp", "cover.svg"]


def find_cover_media(folder: Path, slug: str) -> dict:
    for name in PREFERRED_VIDEOS:
        path = folder / name
        if path.is_file():
            return {"media": f"projects/{slug}/{name}", "mediaType": "video"}

    for name in PREFERRED_IMAGES:
        path = folder / name
        if path.is_file():
            return {"media": f"projects/{slug}/{name}", "mediaType": "image"}

    for path in sorted(folder.iterdir()):
        if path.is_file() and path.suffix.lower() in VIDEO_EXTS:
            return {"media": f"projects/{slug}/{path.name}", "mediaType": "video"}

    for path in sorted(folder.iterdir()):
        if path.is_file() and path.suffix.lower() in IMAGE_EXTS and path.name != "info.json":
            return {"media": f"projects/{slug}/{path.name}", "mediaType": "image"}

    return {"media": "", "mediaType": ""}


def main() -> None:
    projects = []

    if PROJECTS_DIR.is_dir():
        for folder in PROJECTS_DIR.iterdir():
            if not folder.is_dir():
                continue

            info_file = folder / "info.json"
            if not info_file.is_file():
                continue

            info = json.loads(info_file.read_text(encoding="utf-8"))
            cover = find_cover_media(folder, folder.name)
            projects.append(
                {
                    "id": folder.name,
                    "title": info.get("title", folder.name),
                    "description": info.get("description", ""),
                    "details": info.get("details", info.get("description", "")),
                    "status": info.get("status", ""),
                    "link": info.get("link", ""),
                    "links": info.get("links", []),
                    "sections": info.get("sections", []),
                    "media": cover["media"],
                    "mediaType": cover["mediaType"],
                    "modified": int(info_file.stat().st_mtime),
                }
            )

    featured_order = ["soul-stone", "vampire-survival"]

    def sort_key(item: dict) -> tuple:
        try:
            rank = featured_order.index(item["id"])
        except ValueError:
            rank = len(featured_order) + 1
        return (rank, -item["modified"])

    projects.sort(key=sort_key)

    output = ROOT / "projects.json"
    output.write_text(json.dumps(projects, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Updated {output}")


if __name__ == "__main__":
    main()
