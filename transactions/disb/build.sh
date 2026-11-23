#!/usr/bin/env zsh
# ─────────────────────────────────────────────
# Build script for transactions/disb
# Usage:  ./build.sh
# Input:  date-util.js, disb.css + disb-*.js, disb-*.css trong thư mục này (tự nhận file disb-* mới theo tên)
#         + CSS của module khác build chung (extra_css_files): ../hk/hk-sla.css
# Output: dist/date-util.min.js, dist/disb.min.css, dist/disb-*.min.js, dist/disb-*.min.css,
#         dist/hk-sla.min.css, disb.zip
# ─────────────────────────────────────────────

set -e
cd "$(dirname "$0")"

ESBUILD="../../node-shell-api/node_modules/.bin/esbuild"

if [[ ! -x "$ESBUILD" ]]; then
  echo "❌  esbuild not found at $ESBUILD"
  echo "   Run: cd ../../node-shell-api && yarn install"
  exit 1
fi

# Glob không khớp file nào thì trả mảng rỗng thay vì báo lỗi
setopt NULL_GLOB
# date-util.js đứng đầu: disb-sla.js cần DateUtil (nạp theo đúng thứ tự này trên trang)
js_files=(date-util.js disb-*.js)
css_files=(disb.css disb-*.css)
# CSS module khác dùng chung bản build/đóng gói của disb (SLA màn hậu kiểm); thêm file mới vào đây
extra_css_files=(../hk/hk-sla.css)

for required in date-util.js disb.css $extra_css_files; do
  if [[ ! -f "$required" ]]; then
    echo "❌  Không tìm thấy $required"
    exit 1
  fi
done

mkdir -p dist
# Xoá bản build cũ để file đã đổi tên/xoá không còn sót trong dist
rm -f dist/date-util.min.js dist/disb.min.css dist/disb-*.min.js dist/disb-*.min.css dist/hk-*.min.css

for f in $js_files; do
  out="dist/${f:r}.min.js"
  echo "▶  Validating $f syntax..."
  node --check "$f"

  # --target=es5: báo lỗi nếu code dùng cú pháp mới hơn ES5 (let/const, arrow, class...)
  echo "▶  Minifying $f → $out"
  $ESBUILD "$f" --minify --target=es5 --log-level=warning --outfile="$out"

  echo "▶  Validating $out..."
  node --check "$out"
done

# ${f:t:r}: bỏ thư mục và đuôi file (../hk/hk-sla.css -> hk-sla)
for f in $css_files $extra_css_files; do
  out="dist/${f:t:r}.min.css"
  echo "▶  Minifying $f → $out"
  $ESBUILD "$f" --minify --log-level=warning --outfile="$out"
done

echo ""
echo "✅  Build complete:"
ls -lh dist/

rm -f disb.zip
zip -rq disb.zip dist/
echo "📦  disb.zip"
