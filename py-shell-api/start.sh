#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

exec "$ROOT_DIR/.venv/bin/python" -m uvicorn app.main:app \
  --env-file "$ROOT_DIR/.env" \
  --host 0.0.0.0 \
  --port 8000