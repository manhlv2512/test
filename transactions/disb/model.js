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

    /* "2026-11-07 14:25:51" -> Date (giờ local). Trả về null nếu sai định dạng. */
    function parseDateTime(text) {
        var m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(String(text || ""));
        if (!m) {
            return null;
        }
        return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    }

    /* Date -> "dd/MM/yyyy HH:mm:ss" */
    function formatDateTime(date) {
        if (!date) {
            return "";
        }
        return pad(date.getDate()) + "/" + pad(date.getMonth() + 1) + "/" + date.getFullYear() +
            " " + pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds());
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

    /* Response API { error, total, count, lists } -> { total, page, data } của js-table.
       lists được chuẩn hoá key Oracle -> camelCase. Trả thêm error để caller hiển thị Toast. */
    function mapResponse(request, res) {
        res = res || {};
        if (res.error) {
            return {
                total: 0,
                page: request.page,
                data: [],
                error: res.error
            };
        }
        var lists = Object.prototype.toString.call(res.lists) === "[object Array]" ? res.lists : [];
        return {
            total: typeof res.total === "number" ? res.total : lists.length,
            page: request.page,
            data: normalizeRows(lists)
        };
    }

    /* Thay {field} trong template bằng encodeURIComponent(row[field]). */
    function fillTemplate(template, row) {
        return String(template).replace(/\{([^}]+)\}/g, function (all, key) {
            var v = row ? row[key] : null;
            return v === null || v === undefined ? "" : encodeURIComponent(v);
        });
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
        return cfg && cfg.url ? fillTemplate(cfg.url, row) : "";
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
        parseDateTime: parseDateTime,
        formatDateTime: formatDateTime,
        mapResponse: mapResponse,
        normalizeRow: normalizeRow,
        normalizeRows: normalizeRows,
        toOracleKey: toOracleKey,
        findMissingFields: findMissingFields,
        fillTemplate: fillTemplate,
        isSafeUrl: isSafeUrl,
        openUrl: openUrl,
        buildDetailUrl: buildDetailUrl,
        buildCreateUrl: buildCreateUrl
    };
})();