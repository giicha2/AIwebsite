#!/usr/bin/env bash
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$PWD"

# Synology Drive Client path on Mac (Mywebsite share)
CANDIDATES=(
  "$HOME/Library/CloudStorage/SynologyDrive-Mywebsite"
  "$HOME/Library/CloudStorage/SynologyDrive-Mywebsite/MyWebsite"
  "$HOME/SynologyDrive/Mywebsite"
  "$HOME/SynologyDrive/Mywebsite/MyWebsite"
)

DRIVE_ROOT=""
for path in "${CANDIDATES[@]}"; do
  if [[ -d "$path" && -f "$path/index.html" || -d "$path" ]]; then
    if [[ -f "$path/index.html" ]] || [[ "$(basename "$path")" == "MyWebsite" ]]; then
      :
    fi
  fi
done

# Prefer share root that contains index.html or MyWebsite
for path in \
  "$HOME/Library/CloudStorage/SynologyDrive-Mywebsite" \
  "$HOME/SynologyDrive/Mywebsite"
do
  if [[ -d "$path" ]]; then
    DRIVE_ROOT="$path"
    break
  fi
done

if [[ -z "$DRIVE_ROOT" ]]; then
  echo "Synology Drive folder not found. Skip deploy."
  echo "Expected e.g. ~/Library/CloudStorage/SynologyDrive-Mywebsite"
  exit 0
fi

DRIVE_SITE="$DRIVE_ROOT/MyWebsite"
mkdir -p "$DRIVE_SITE"

EXCLUDE=(
  --exclude '.git'
  --exclude 'Docs'
  --exclude '.cursor'
  --exclude 'shots/thumbs'
  --exclude 'videos/thumbs'
  --exclude 'desktop.ini'
  --exclude '.DS_Store'
  --exclude 'writable/blog-auth.json'
  --exclude 'writable/blog-sessions.json'
  --exclude 'writable/portfolio.json'
)

echo "Deploying to Synology Drive..."
rsync -a --delete "${EXCLUDE[@]}" "$SRC/" "$DRIVE_SITE/"
rsync -a "${EXCLUDE[@]}" \
  --exclude 'MyWebsite' \
  --exclude 'git' \
  --exclude 'Unreal Projects' \
  --exclude '.SynologyWorkingDirectory' \
  "$SRC/" "$DRIVE_ROOT/"

echo "Deployed to:"
echo "  $DRIVE_SITE"
echo "  $DRIVE_ROOT"
echo "Wait for Synology Drive sync, then hard-refresh the live site."
