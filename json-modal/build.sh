#!/usr/bin/env zsh
# ─────────────────────────────────────────────
# Build script for json-modal
# Usage:  ./build.sh
# Output: dist/json-modal.min.js  dist/json-modal.min.css
# ─────────────────────────────────────────────

set -e
cd "$(dirname "$0")"

ESBUILD="../node-shell-api/node_modules/.bin/esbuild"

if [[ ! -x "$ESBUILD" ]]; then
  echo "❌  esbuild not found at $ESBUILD"
  echo "   Run: cd ../node-shell-api && yarn install"
  exit 1
fi

mkdir -p dist

echo "▶  Validating json-modal.js syntax..."
node --check json-modal.js

echo "▶  Minifying json-modal.js → dist/json-modal.min.js"
$ESBUILD json-modal.js --minify --outfile=dist/json-modal.min.js

echo "▶  Validating dist/json-modal.min.js..."
node --check dist/json-modal.min.js

echo "▶  Minifying json-modal.css → dist/json-modal.min.css"
$ESBUILD json-modal.css --minify --outfile=dist/json-modal.min.css

echo ""
echo "✅  Build complete:"
ls -lh dist/

zip -r json-modal.zip dist/
