#!/usr/bin/env bash
set -euo pipefail

DIR=$(cd "$(dirname "$0")" && pwd)
cd "$DIR"

if [ -d .venv ]; then
  source .venv/bin/activate
fi

exec uvicorn main:app --reload --host 0.0.0.0 --port 8000
