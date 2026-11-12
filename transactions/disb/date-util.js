/* Tiện ích ngày giờ dùng chung (ES5), bọc moment.js (js-table/libs/moment-with-locales.min.js).
   Nạp sau moment, trước disb-util.js và disb-sla.js.

   Quy ước:
   - Mọi giá trị ngày đều tính theo giờ local của trình duyệt.
   - Hàm nhận "value" chấp nhận: moment | Date | số ms | chuỗi ISO 8601 (có hoặc không múi giờ,
     phân cách "T" hoặc dấu cách) | "DD/MM/YYYY[ HH:mm[:ss]]".
   - Giá trị rỗng hoặc sai định dạng: parse trả null, format trả "". */
var DateUtil = (function (moment) {
    if (!moment) {
        throw new Error("DateUtil: cần nạp moment.js trước date-util.js");
    }

    var FORMAT = {
        DATE: "YYYY-MM-DD",
        DATETIME: "YYYY-MM-DD HH:mm:ss",
        TIME: "HH:mm:ss",
        DISPLAY_DATE: "DD/MM/YYYY",
        DISPLAY_DATETIME: "DD/MM/YYYY HH:mm:ss"
    };

    /* Định dạng server "YYYY-MM-DD HH:mm:ss": đường nhanh (regex + moment(array)), nhanh hơn
       parse strict ISO nhiều lần, cần khi xử lý cả triệu dòng. moment(array) vẫn kiểm tra
       ngày/giờ hợp lệ (vd tháng 13 -> invalid). */
    var SERVER_RE = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/;

    /* Định dạng thử sau ISO 8601 (ISO đã gồm "YYYY-MM-DD", "YYYY-MM-DD HH:mm", "...T...+07:00") */
    var FALLBACK_FORMATS = ["DD/MM/YYYY HH:mm:ss", "DD/MM/YYYY HH:mm", "DD/MM/YYYY"];

    /* -> moment hợp lệ hoặc null. Luôn trả bản sao, không làm thay đổi input. */
    function parse(value) {
        if (value === null || value === undefined || value === "") {
            return null;
        }
        var m, text, r;
        if (moment.isMoment(value) || value instanceof Date || typeof value === "number") {
            m = moment(value);
        } else {
            text = String(value);
            r = SERVER_RE.exec(text);
            if (r) {
                m = moment([+r[1], +r[2] - 1, +r[3], +r[4], +r[5], +r[6]]);
            } else {
                /* Parse strict từng bước: một định dạng nhanh hơn nhiều so với truyền cả mảng */
                m = moment(text, moment.ISO_8601, true);
                if (!m.isValid()) {
                    m = moment(text, FALLBACK_FORMATS, true);
                }
            }
        }
        return m.isValid() ? m : null;
    }

    /* -> Date hoặc null */
    function toDate(value) {
        var m = parse(value);
        return m ? m.toDate() : null;
    }

    /* -> số ms hoặc null */
    function toMillis(value) {
        var m = parse(value);
        return m ? m.valueOf() : null;
    }

    /* Format, mặc định "DD/MM/YYYY HH:mm:ss". Sai/rỗng -> "". */
    function format(value, pattern) {
        var m = parse(value);
        return m ? m.format(pattern || FORMAT.DISPLAY_DATETIME) : "";
    }

    function pad(n) {
        return n < 10 ? "0" + n : String(n);
    }

    /* Chuỗi gửi server / lưu mock: "YYYY-MM-DD HH:mm:ss".
       Số ms hoặc Date: ghép chuỗi trực tiếp, nhanh hơn moment().format() ~5 lần
       (đo: 3 triệu lần gọi ~0,5 giây so với ~2,5 giây), cần khi sinh 1 triệu dòng mock. */
    function toServer(value) {
        if (typeof value === "number" || value instanceof Date) {
            var d = typeof value === "number" ? new Date(value) : value;
            if (isNaN(d.getTime())) {
                return "";
            }
            return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " +
                pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
        }
        return format(value, FORMAT.DATETIME);
    }

    /* "YYYY-MM-DD" (khoá ngày, so sánh ngày lễ) */
    function dayKey(value) {
        return format(value, FORMAT.DATE);
    }

    /* Đầu ngày (00:00:00 local), trả moment mới hoặc null */
    function startOfDay(value) {
        var m = parse(value);
        return m ? m.startOf("day") : null;
    }

    /* Thứ trong tuần: 0 = Chủ nhật ... 6 = Thứ bảy (giống Date.getDay) */
    function weekday(value) {
        var m = parse(value);
        return m ? m.day() : -1;
    }

    /* "08:00" | "08:00:30" -> số giây kể từ 00:00. Sai định dạng -> NaN. */
    function timeToSeconds(hhmm) {
        var m = moment(String(hhmm || ""), ["HH:mm:ss", "HH:mm"], true);
        return m.isValid() ? m.hours() * 3600 + m.minutes() * 60 + m.seconds() : NaN;
    }

    /* Cộng thời gian: add(value, 3, "hours") -> moment mới hoặc null */
    function add(value, amount, unit) {
        var m = parse(value);
        return m ? m.add(amount, unit) : null;
    }

    /* b - a theo đơn vị (mặc định giây). Thiếu giá trị -> NaN. */
    function diff(a, b, unit) {
        var ma = parse(a), mb = parse(b);
        return ma && mb ? mb.diff(ma, unit || "seconds", true) : NaN;
    }

    function now() {
        return moment();
    }

    return {
        FORMAT: FORMAT,
        parse: parse,
        toDate: toDate,
        toMillis: toMillis,
        format: format,
        toServer: toServer,
        dayKey: dayKey,
        startOfDay: startOfDay,
        weekday: weekday,
        timeToSeconds: timeToSeconds,
        add: add,
        diff: diff,
        now: now
    };
})(window.moment);
