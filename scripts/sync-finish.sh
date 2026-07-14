#!/usr/bin/env bash
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 \"commit message\""
  exit 1
fi

DID_PUSH=0

git add -A
if ! git diff --cached --quiet; then
  git commit -m "$1"
  git push
  DID_PUSH=1
  echo "Changes pushed."
else
  echo "No new commit. Working tree clean for git."
fi

bash "$(dirname "$0")/deploy-to-synology.sh"

if [[ "$DID_PUSH" -eq 1 ]]; then
  echo "Done: GitHub push + Synology Drive deploy."
else
  echo "Done: Synology Drive deploy only."
fi
