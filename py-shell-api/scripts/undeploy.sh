#!/usr/bin/env bash
#
# undeploy.sh - sample teardown script.
# Accepts optional arguments, e.g.: ["--env", "staging"]
#
set -euo pipefail

ENVIRONMENT="${1:-production}"

echo "[undeploy] Starting teardown for '${ENVIRONMENT}'..."
echo "[undeploy] Stopping running containers..."
sleep 1
echo "[undeploy] Removing deployed resources..."
sleep 1
echo "[undeploy] Undeploy for '${ENVIRONMENT}' completed successfully."
