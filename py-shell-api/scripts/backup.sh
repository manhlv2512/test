#!/usr/bin/env bash
#
# backup.sh - sample backup script.
# Accepts an optional target label, e.g.: ["database"]
#
set -euo pipefail

TARGET="${1:-all}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

echo "[backup] Creating backup for target '${TARGET}'..."
sleep 1
echo "[backup] Backup archive: backup-${TARGET}-${TIMESTAMP}.tar.gz"
echo "[backup] Backup completed successfully."
