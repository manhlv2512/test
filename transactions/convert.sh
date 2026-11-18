#!/usr/bin/env zsh
# ─────────────────────────────────────────────
# Convert file .json -> file .txt CÙNG THƯ MỤC, cùng tên: 1 dòng, đúng kết quả JSON.stringify(dữ liệu)
# Usage:  convert.sh <đường dẫn file .json> [--escape]
#   Đường dẫn tính từ thư mục đang đứng (tương đối hoặc tuyệt đối), không phải từ thư mục chứa script:
#     (trong transactions)     ./convert.sh hk/table-config.json      -> hk/table-config.txt
#     (trong transactions)     ./convert.sh disb/report_header.json   -> disb/report_header.txt
#     (trong transactions/hk)  ../convert.sh table-config.json        -> table-config.txt
#     (ở gốc repo)             transactions/convert.sh transactions/disb/disb-config.json
#   Bỏ đuôi .json cũng được:       ./convert.sh hk/table-config
#   Gõ nhầm đuôi .txt thì tự đổi:  ./convert.sh hk/table-config.txt   (đọc hk/table-config.json)
#   --escape: JSON.stringify thêm 1 lần => chuỗi có dấu nháy bao ngoài và \" bên trong,
#             dùng khi dán thẳng vào code JS / câu SQL
# ─────────────────────────────────────────────

set -e

# Lưu cách gọi script: trong function, zsh đặt $0 là tên function
SCRIPT_CMD="$0"

usage() {
  echo "Usage: $SCRIPT_CMD <đường dẫn file .json> [--escape]    vd: $SCRIPT_CMD hk/table-config.json"
  setopt LOCAL_OPTIONS NULL_GLOB
  local dir="${1:-.}"
  local -a found
  if [[ "$dir" == "." ]]; then
    found=(*.json */*.json)
  else
    found=("${dir%/}"/*.json)
  fi
  if (( ${#found} > 20 )); then
    found=("${(@)found[1,20]}" "…")
  fi
  if (( ${#found} )); then
    echo "File .json có thể dùng: ${(j:, :)found}"
  fi
}

ESCAPE=0
ARGS=()
for a in "$@"; do
  case "$a" in
    --escape)  ESCAPE=1 ;;
    -h|--help) usage; exit 0 ;;
    -*)        echo "❌  Tuỳ chọn không hợp lệ: $a"; usage; exit 1 ;;
    *)         ARGS+=("$a") ;;
  esac
done

if (( ${#ARGS} == 0 )); then
  usage
  exit 1
fi
if (( ${#ARGS} > 1 )); then
  echo "❌  Chỉ nhận 1 file (đang truyền ${#ARGS}: ${ARGS[*]})"
  usage
  exit 1
fi

ARG="${ARGS[1]}"
if [[ -d "$ARG" ]]; then
  echo "❌  $ARG là thư mục, cần đường dẫn tới file .json"
  usage "$ARG"
  exit 1
fi

# Chuẩn hoá về file .json (giữ nguyên thư mục): x.json -> x.json, x.txt -> x.json, x -> x.json
case "${ARG:e:l}" in
  json) IN="$ARG" ;;
  txt)  IN="${ARG:r}.json" ;;
  *)    IN="$ARG.json" ;;
esac
# File ra: cùng thư mục, cùng tên với file .json, đổi đuôi thành .txt
OUT="${IN:r}.txt"

if [[ ! -f "$IN" ]]; then
  echo "❌  Không tìm thấy file $IN"
  usage "${IN:h}"
  exit 1
fi
if ! command -v node >/dev/null; then
  echo "❌  Cần Node.js để chạy convert"
  exit 1
fi

node -e '
var fs = require("fs");
var input = process.argv[1], output = process.argv[2], escape = process.argv[3] === "1";
var text;
try {
    text = fs.readFileSync(input, "utf8").replace(/^\uFEFF/, "");
} catch (e) {
    console.error("❌  Không đọc được " + input + ": " + e.message);
    process.exit(1);
}
var data;
try {
    data = JSON.parse(text);
} catch (e) {
    console.error("❌  " + input + " không phải JSON hợp lệ: " + e.message);
    process.exit(1);
}
var out = JSON.stringify(data);
if (escape) { out = JSON.stringify(out); }
try {
    fs.writeFileSync(output, out);
} catch (e) {
    console.error("❌  Không ghi được " + output + ": " + e.message);
    process.exit(1);
}

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
