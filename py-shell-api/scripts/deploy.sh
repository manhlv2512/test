#!/usr/bin/env bash
#
# deploy.sh - sample deployment script.
# Accepts optional arguments, e.g.: ["--env", "staging"]
#
set -euo pipefail

ENVIRONMENT="${1:-production}"

echo "[deploy] Starting deployment to '${ENVIRONMENT}'..."
echo "[deploy] Pulling latest changes..."
sleep 1
echo "[deploy] Building application..."
sleep 1
echo "[deploy] Deployment to '${ENVIRONMENT}' completed successfully."
