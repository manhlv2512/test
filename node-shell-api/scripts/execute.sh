#!/usr/bin/env bash
#
# LOCAL-mode sample script (EXEC_MODE=local), used mainly for DEV on macOS to
# test the API end-to-end without touching a real host.
#
# In UAT/PROD you normally DON'T run this file. Instead the API uses
# EXEC_MODE=ssh and runs SSH_REMOTE_COMMAND directly on the target RedHat host
# (optionally via a bastion), e.g.:
#
#   cd /opt/app && ./admin.sh -f /local/install.py {{ARGS}}
#
# This local script just emulates that flow so you can verify request/response,
# auth, logging and timeouts locally.

set -euo pipefail

echo "[execute.sh] LOCAL mode - simulating admin.sh / install.py flow"
echo "[execute.sh] DATA_DIR=${DATA_DIR:-unset} LOG_DIR=${LOG_DIR:-unset}"
echo "[execute.sh] args: $*"

# Simulate work
sleep 1
echo "[execute.sh] done"
