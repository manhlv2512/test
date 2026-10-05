#!/usr/bin/env bash
#
# restart.sh - sample service restart script.
# Does not accept arguments.
#
set -euo pipefail

SERVICE_NAME="app"

echo "[restart] Stopping service '${SERVICE_NAME}'..."
sleep 1
echo "[restart] Starting service '${SERVICE_NAME}'..."
sleep 1
echo "[restart] Service '${SERVICE_NAME}' restarted successfully."
