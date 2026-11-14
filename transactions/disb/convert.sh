#!/usr/bin/env zsh
# ─────────────────────────────────────────────
# Convert table-config.json -> table-config.txt: 1 dòng, đúng kết quả JSON.stringify(config)
# Usage:  ./convert.sh [input.json] [output.txt] [--escape]
#   Mặc định: table-config.json -> table-config.txt
#   --escape: JSON.stringify thêm 1 lần => chuỗi có dấu nháy bao ngoài và \" bên trong,
#             dùng khi dán thẳng vào code JS / câu SQL
# ─────────────────────────────────────────────

set -e
cd "$(dirname "$0")"

ESCAPE=0
ARGS=()
for a in "$@"; do
  if [[ "$a" == "--escape" ]]; then ESCAPE=1; else ARGS+=("$a"); fi
done
IN="${ARGS[1]:-table-config.json}"
OUT="${ARGS[2]:-${IN:r}.txt}"

if [[ ! -f "$IN" ]]; then
  echo "❌  Không tìm thấy $IN"
  exit 1
fi
if ! command -v node >/dev/null; then
  echo "❌  Cần Node.js để chạy convert"
  exit 1
fi

node -e '
var fs = require("fs");
var input = process.argv[1], output = process.argv[2], escape = process.argv[3] === "1";
var text = fs.readFileSync(input, "utf8").replace(/^\uFEFF/, "");
var config;
try {
    config = JSON.parse(text);
} catch (e) {
    console.error("❌  " + input + " không phải JSON hợp lệ: " + e.message);
    process.exit(1);
}
var out = JSON.stringify(config);
if (escape) { out = JSON.stringify(out); }
fs.writeFileSync(output, out);

/* Đọc lại file vừa ghi, phải ra đúng config ban đầu */
var back = JSON.parse(fs.readFileSync(output, "utf8"));
if (escape) { back = JSON.parse(back); }
if (JSON.stringify(back) !== JSON.stringify(config)) {
    console.error("❌  Kiểm tra lại " + output + " không khớp với " + input);
    process.exit(1);
}
console.log("✅  " + input + " (" + Buffer.byteLength(text) + " bytes) → " + output +
    " (" + Buffer.byteLength(out) + " bytes, 1 dòng" + (escape ? ", đã escape" : "") + ")");
' "$IN" "$OUT" "$ESCAPE"
