#!/usr/bin/env bash
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
git pull --rebase
echo "Ready to work. Run scripts/sync-finish.sh when done."
echo "Also read Docs/SESSION_HANDOFF.md (Cursor rule does this after pull)."
