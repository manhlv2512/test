/* Model / mapping cho màn hình giải ngân (ES5, không phụ thuộc DOM trừ openLink). */
var DisbUtil = (function () {
    function pad(n) {
        return n < 10 ? "0" + n : String(n);
    }

    function escapeHtml(value) {
        return String(value === null || value === undefined ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    /* ---------------- Chuẩn hoá key Oracle -> field client ----------------
       Oracle trả alias in hoa dạng SNAKE_CASE; client đổi sang camelCase.
       Tên field client do alias trong SP quyết định, vd TRANSACTION_TYPE1_NAME -> transactionType1Name. */

    /* "GNTD_CODE" -> "gntdCode", "TRANSACTION_TYPE1_NAME" -> "transactionType1Name" */
    function toCamel(key) {
        return String(key).toLowerCase().replace(/_([a-z0-9])/g, function (all, c) {
            return c.toUpperCase();
        });
    }

    /* Key đã có chữ thường (camelCase từ BE/mock) thì giữ nguyên. */
    function isOracleKey(key) {
        return /^[A-Z0-9_]+$/.test(key);
    }

    /* "transactionType1Name" -> "TRANSACTION_TYPE1_NAME": alias SP cần trả để toCamel ra đúng field. */
    function toOracleKey(name) {
        return String(name).replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();
    }

    /* Các field client cần mà dòng dữ liệu (đã toCamel) không có.
       Trả [{ field, oracleKey }] để báo SP đặt sai/thiếu alias. */
    function findMissingFields(row, fields) {
        var missing = [], i;
        if (!row || typeof row !== "object") {
            return missing;
        }
        for (i = 0; i < fields.length; i++) {
            if (!row.hasOwnProperty(fields[i])) {
                missing.push({ field: fields[i], oracleKey: toOracleKey(fields[i]) });
            }
        }
        return missing;
    }

    /* Chuẩn hoá một dòng. Không ghi đè field camelCase đã có sẵn trong dòng. */
    function normalizeRow(row) {
        if (!row || typeof row !== "object") {
            return row;
        }
        var out = {}, key, name;
        for (key in row) {
            if (row.hasOwnProperty(key) && !isOracleKey(key)) {
                out[key] = row[key];
            }
        }
        for (key in row) {
            if (row.hasOwnProperty(key) && isOracleKey(key)) {
                name = toCamel(key);
                if (!out.hasOwnProperty(name)) {
                    out[name] = row[key];
                }
            }
        }
        return out;
    }

    function normalizeRows(lists) {
        var out = [], i;
        for (i = 0; i < lists.length; i++) {
            out.push(normalizeRow(lists[i]));
        }
        return out;
    }

    /* ---------------- Mảng -> object tra cứu theo key ----------------
        arrayToMap([{ code: "TT", name: "Tập trung" }], "code", "name") -> { TT: "Tập trung" }
        arrayToMap([{ code: "TT", name: "Tập trung" }])                 -> { TT: { code: "TT", name: "Tập trung" } }
        - keyField mặc định "code". Không truyền valueField thì giá trị là cả phần tử (cùng tham chiếu, không copy).
        - Bỏ qua phần tử không phải object và phần tử có key null/undefined/"". Trùng key thì phần tử sau ghi đè.
        - Key của object luôn là chuỗi (ID 1 -> "1"). list không phải mảng -> {}.
    */
    function arrayToMap(list, keyField, valueField) {
        var map = {}, i, item, key;
        if (!Array.isArray(list)) {
            return map;
        }
        keyField = keyField || "code";
        // valueField = valueField || "name";
        for (i = 0; i < list.length; i++) {
            item = list[i];
            if (!item || typeof item !== "object") {
                continue;
            }
            key = item[keyField];
            if (key === null || key === undefined || key === "") {
                continue;
            }
            map[key] = valueField ? item[valueField] : item;
        }
        return map;
    }

    /* Chỉ cho phép http/https (đường dẫn tương đối được resolve theo origin hiện tại). */
    function isSafeUrl(url) {
        try {
            var parsed = new URL(url, window.location.href);
            return parsed.protocol === "http:" || parsed.protocol === "https:";
        } catch (e) {
            return false;
        }
    }

    /* Mở link; trả về false nếu bị chặn. */
    function openUrl(url, target) {
        if (!isSafeUrl(url)) {
            return false;
        }
        if (target === "_blank") {
            window.open(url, "_blank", "noopener");
        } else {
            window.location.href = url;
        }
        return true;
    }

    /* Link chi tiết: cfg = { url, target }, row = dòng được bấm. */
    function buildDetailUrl(cfg, row) {
        var url = (cfg && cfg.url) || "";
        var transactionCode = row.gntdCode;
        if (!url || !transactionCode) {
            return "";
        }
        return url + encodeURIComponent(transactionCode)
    }

    function buildCreateUrl(ctg, type) {
        var url = type.url || ctg.url || "";
        var serviceName = type.serviceName;
        if (!url || !serviceName) {
            return "";
        }
        return url + encodeURIComponent(serviceName)
    }

    return {
        escapeHtml: escapeHtml,
        normalizeRow: normalizeRow,
        normalizeRows: normalizeRows,
        arrayToMap: arrayToMap,
        toOracleKey: toOracleKey,
        findMissingFields: findMissingFields,
        isSafeUrl: isSafeUrl,
        openUrl: openUrl,
        buildDetailUrl: buildDetailUrl,
        buildCreateUrl: buildCreateUrl
    };
})();
