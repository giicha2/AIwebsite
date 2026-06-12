#!/bin/bash
set -euo pipefail
dir="$(dirname "$0")"
python3 "$dir/generate-projects.py"
python3 "$dir/generate-media.py"
