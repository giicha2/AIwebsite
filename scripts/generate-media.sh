#!/bin/bash
set -euo pipefail
dir="$(dirname "$0")"
python3 -m pip install -r "$dir/requirements.txt" -q
python3 "$dir/generate-media.py"
