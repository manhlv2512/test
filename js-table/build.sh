#!/usr/bin/env zsh
# ─────────────────────────────────────────────
# Build script for js-table
# Usage:  ./build.sh
# Output: dist/table.min.js  dist/table.min.css
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

echo "▶  Validating table.js syntax..."
node --check table.js

echo "▶  Minifying table.js → dist/table.min.js"
$ESBUILD table.js --minify --outfile=dist/table.min.js

echo "▶  Validating dist/table.min.js..."
node --check dist/table.min.js

echo "▶  Minifying table.css → dist/table.min.css"
$ESBUILD table.css --minify --outfile=dist/table.min.css

echo ""
echo "✅  Build complete:"
ls -lh dist/table.min.js dist/table.min.css
