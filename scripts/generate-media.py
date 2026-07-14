#!/usr/bin/env python3
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".heic"}
VIDEO_EXTS = {".mp4", ".webm", ".mov", ".m4v"}
THUMB_MAX_SIZE = 480
THUMB_QUALITY = 85


def thumb_dir_for(folder: str) -> Path:
    return ROOT / folder / "thumbs"


def load_pillow():
    try:
        from PIL import Image

        return Image
    except ImportError:
        print(
            "Pillow가 필요합니다. 설치: pip install -r scripts/requirements.txt",
            file=sys.stderr,
        )
        return None


def image_thumb_path(folder: str, source: Path, image_mod) -> str | None:
    target_dir = thumb_dir_for(folder)
    target_dir.mkdir(parents=True, exist_ok=True)
    thumb_file = target_dir / f"{source.stem}.jpg"
    source_mtime = source.stat().st_mtime
    rel_path = f"{folder}/thumbs/{thumb_file.name}"

    if thumb_file.is_file() and thumb_file.stat().st_mtime >= source_mtime:
        return rel_path

    with image_mod.open(source) as image:
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
        if image.mode == "RGBA":
            background = image_mod.new("RGB", image.size, (255, 255, 255))
            background.paste(image, mask=image.split()[3])
            image = background
        image.thumbnail((THUMB_MAX_SIZE, THUMB_MAX_SIZE), image_mod.Resampling.LANCZOS)
        image.save(thumb_file, "JPEG", quality=THUMB_QUALITY, optimize=True)

    print(f"  thumb: {rel_path}")
    return rel_path


def video_poster_path(folder: str, source: Path) -> str | None:
    target_dir = thumb_dir_for(folder)
    target_dir.mkdir(parents=True, exist_ok=True)
    poster_file = target_dir / f"{source.stem}.jpg"
    source_mtime = source.stat().st_mtime
    rel_path = f"{folder}/thumbs/{poster_file.name}"

    if poster_file.is_file() and poster_file.stat().st_mtime >= source_mtime:
        return rel_path

    command = [
        "ffmpeg",
        "-y",
        "-ss",
        "00:00:01",
        "-i",
        str(source),
        "-frames:v",
        "1",
        "-q:v",
        "4",
        str(poster_file),
    ]

    try:
        subprocess.run(
            command,
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except (FileNotFoundError, subprocess.CalledProcessError):
        return None

    if not poster_file.is_file():
        return None

    print(f"  poster: {rel_path}")
    return rel_path


def cleanup_orphan_thumbs(folder: str, valid_stems: set[str]) -> None:
    target_dir = thumb_dir_for(folder)

    if not target_dir.is_dir():
        return

    for path in target_dir.iterdir():
        if not path.is_file() or path.suffix.lower() != ".jpg":
            continue

        if path.stem not in valid_stems:
            path.unlink()
            print(f"  removed orphan: {folder}/thumbs/{path.name}")


def build_media_item(folder: str, path: Path, extensions: set[str], image_mod) -> dict | None:
    if not path.is_file() or path.name.startswith("."):
        return None

    if path.suffix.lower() not in extensions:
        return None

    item = {
        "src": f"{folder}/{path.name}",
        "name": path.stem,
        "modified": int(path.stat().st_mtime),
    }

    if folder == "shots":
        if image_mod is None:
            print(f"  skip thumb (Pillow missing): {item['src']}", file=sys.stderr)
        else:
            thumb = image_thumb_path(folder, path, image_mod)
            if thumb:
                item["thumb"] = thumb
    elif folder == "videos":
        poster = video_poster_path(folder, path)
        if poster:
            item["poster"] = poster

    return item


def scan_folder(folder: str, extensions: set[str], image_mod) -> list[dict]:
    items = []
    target = ROOT / folder

    if not target.is_dir():
        return items

    for path in sorted(target.iterdir()):
        item = build_media_item(folder, path, extensions, image_mod)
        if item:
            items.append(item)

    valid_stems = {item["name"] for item in items}
    cleanup_orphan_thumbs(folder, valid_stems)
    items.sort(key=lambda entry: entry["modified"], reverse=True)
    return items


def main() -> None:
    image_mod = load_pillow()

    print("Generating gallery thumbnails...")
    data = {
        "photos": scan_folder("shots", IMAGE_EXTS, image_mod),
        "videos": scan_folder("videos", VIDEO_EXTS, image_mod),
    }

    output = ROOT / "media.json"
    output.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Updated {output}")


if __name__ == "__main__":
    main()
