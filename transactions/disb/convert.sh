#!/usr/bin/env zsh
# ─────────────────────────────────────────────
# Convert <tên>.json -> <tên>.txt: 1 dòng, đúng kết quả JSON.stringify(dữ liệu)
# Usage:  ./convert.sh <tên> [--escape]
#   ./convert.sh disb-config      disb-config.json   -> disb-config.txt
#   ./convert.sh report_header    report_header.json -> report_header.txt
#   Gõ kèm đuôi .json / .txt cũng được (tự bỏ đuôi): ./convert.sh disb-config.json
#   --escape: JSON.stringify thêm 1 lần => chuỗi có dấu nháy bao ngoài và \" bên trong,
#             dùng khi dán thẳng vào code JS / câu SQL
# ─────────────────────────────────────────────

set -e
cd "$(dirname "$0")"

usage() {
  echo "Usage: ./convert.sh <tên> [--escape]    vd: ./convert.sh disb-config"
  setopt LOCAL_OPTIONS NULL_GLOB
  local -a found names
  found=(*.json)
  names=(${found:r})   # bỏ đuôi .json từng phần tử
  if (( ${#names} )); then
    echo "Các tên có file .json trong thư mục: ${(j:, :)names}"
  fi
}

ESCAPE=0
NAMES=()
for a in "$@"; do
  case "$a" in
    --escape)  ESCAPE=1 ;;
    -h|--help) usage; exit 0 ;;
    -*)        echo "❌  Tuỳ chọn không hợp lệ: $a"; usage; exit 1 ;;
    *)         NAMES+=("$a") ;;
  esac
done

if (( ${#NAMES} == 0 )); then
  usage
  exit 1
fi
if (( ${#NAMES} > 1 )); then
  echo "❌  Chỉ nhận 1 tên file (đang truyền ${#NAMES}: ${NAMES[*]})"
  usage
  exit 1
fi

NAME="${NAMES[1]}"
# Gõ kèm đuôi (vd tab-complete) thì bỏ đuôi: disb-config.json -> disb-config
if [[ "$NAME" == *.json || "$NAME" == *.txt ]]; then
  NAME="${NAME:r}"
fi
IN="$NAME.json"
OUT="$NAME.txt"

if [[ ! -f "$IN" ]]; then
  echo "❌  Không tìm thấy $IN"
  usage
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
var data;
try {
    data = JSON.parse(text);
} catch (e) {
    console.error("❌  " + input + " không phải JSON hợp lệ: " + e.message);
    process.exit(1);
}
var out = JSON.stringify(data);
if (escape) { out = JSON.stringify(out); }
fs.writeFileSync(output, out);

/* Đọc lại file vừa ghi, phải ra đúng dữ liệu ban đầu */
var back = JSON.parse(fs.readFileSync(output, "utf8"));
if (escape) { back = JSON.parse(back); }
if (JSON.stringify(back) !== JSON.stringify(data)) {
    console.error("❌  Kiểm tra lại " + output + " không khớp với " + input);
    process.exit(1);
}
console.log("✅  " + input + " (" + Buffer.byteLength(text) + " bytes) → " + output +
    " (" + Buffer.byteLength(out) + " bytes, 1 dòng" + (escape ? ", đã escape" : "") + ")");
' "$IN" "$OUT" "$ESCAPE"
