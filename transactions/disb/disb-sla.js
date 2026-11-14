/* Tính SLA ở client theo logic BPM (disb-sla.js), ES5, không phụ thuộc DOM.
   Cần nạp trước: moment.js, date-util.js. Cấu hình: mục "sla" trong table-config.json.

   - Chỉ tính cho hồ sơ có trạng thái thuộc activeStates (BPM: DB_STATUS_CODE.CHO_XU_LY)
     và có đủ yellowFlagDate + redFlagDate (BE trả). Thiếu một trong hai thì không hiển thị.
   - now trong (yellow, red)  -> "warning", còn = giờ làm việc từ now đến red
     red < now                -> "overdue", quá = giờ làm việc từ red đến now
     còn lại                  -> "ok",      còn = giờ làm việc từ now đến red
   - Giờ làm việc: các phiên trong workingHours theo thứ (workday), bỏ ngày lễ (holidays)
     và ngày không có phiên nào (vd Chủ nhật).
       weekDays:     ["Sunday", "Monday", ..., "Saturday"]  (7 phần tử, 0 = Chủ nhật)
       workingHours: [{ workday: "Monday", startTime: "08:00", endTime: "12:00" }, ...]
       holidays:     [{ day: "2026-01-01", description: "Tết Dương lịch" }, ...]
                     (key trùng alias cột SQL, gán thẳng kết quả query, không cần đổi key)

   Khác bản BPM (đã sửa lỗi của bản gốc):
   - Bản gốc so startTimeValue dạng HHmm (800) với số giây trong ngày, và cộng workTime
     (giờ, "8.5") vào tổng giây cho ngày đủ => sai đơn vị. Ở đây đổi hết về giây từ startTime/endTime.
   - Bản gốc trừ trọn 86400 giây cho ngày nghỉ kể cả khi khoảng thời gian bắt đầu giữa ngày.
     Ở đây tính phần giao nhau của [from, to] với từng phiên làm việc nên chính xác tới giây.
   - formatDate gốc trộn getUTCFullYear với getMonth/getDate local. Ở đây dùng ngày local. */
var DisbSla = (function (DateUtil) {
    var MAX_DAYS = 3660; /* ~10 năm, chặn vòng lặp khi dữ liệu sai */

    /* Chuẩn hoá cấu hình một lần, cache trên cfg. */
    function prepare(cfg) {
        if (cfg.__slaCache) {
            return cfg.__slaCache;
        }
        var sessions = [[], [], [], [], [], [], []];
        var holidaySet = {}; /* key = ms đầu ngày (local) */
        var weekDays = Object.prototype.toString.call(cfg.weekDays) === "[object Array]" ? cfg.weekDays : [];
        var hours = cfg.workingHours || [];
        var holidays = cfg.holidays || [];
        var i, j, idx, from, to, day, perDay = 0, dayTotal;

        for (i = 0; i < hours.length; i++) {
            idx = weekDays.indexOf(hours[i].workday);
            from = DateUtil.timeToSeconds(hours[i].startTime);
            to = DateUtil.timeToSeconds(hours[i].endTime);
            if (idx >= 0 && to > from) {
                sessions[idx].push({ from: from, to: to });
            }
        }
        for (i = 0; i < 7; i++) {
            sessions[i].sort(function (a, b) { return a.from - b.from; });
            dayTotal = 0;
            for (j = 0; j < sessions[i].length; j++) {
                dayTotal += sessions[i][j].to - sessions[i][j].from;
            }
            perDay = Math.max(perDay, dayTotal);
        }
        for (i = 0; i < holidays.length; i++) {
            day = DateUtil.startOfDay(holidays[i] && holidays[i].day);
            if (day) {
                holidaySet[day.valueOf()] = true;
            }
        }

        cfg.__slaCache = {
            /* weekDays sai thì mọi ngày thành ngày nghỉ => không tính SLA thay vì hiện số sai */
            valid: weekDays.length === 7,
            sessions: sessions,
            holidaySet: holidaySet,
            perDayMinutes: perDay / 60
        };
        return cfg.__slaCache;
    }

    /* Ngày nghỉ: ngày lễ hoặc thứ không có phiên làm việc. */
    function isDayOff(value, cfg) {
        var c = prepare(cfg);
        var day = DateUtil.startOfDay(value);
        return !day || !!c.holidaySet[day.valueOf()] || !c.sessions[day.day()].length;
    }

    /* Số giây làm việc trong khoảng [from, to). from/to: giá trị bất kỳ DateUtil.parse nhận. */
    function workSeconds(from, to, cfg) {
        var a = DateUtil.toMillis(from), b = DateUtil.toMillis(to);
        if (a === null || b === null || b <= a) {
            return 0;
        }
        var c = prepare(cfg);
        var day = DateUtil.startOfDay(a);
        var total = 0, n, i, list, base, s, e;

        for (n = 0; n < MAX_DAYS && day.valueOf() < b; n++) {
            base = day.valueOf();
            list = c.sessions[day.day()];
            if (list.length && !c.holidaySet[base]) {
                for (i = 0; i < list.length; i++) {
                    s = Math.max(base + list[i].from * 1000, a);
                    e = Math.min(base + list[i].to * 1000, b);
                    if (e > s) {
                        total += e - s;
                    }
                }
            }
            day.add(1, "day");
        }
        return total / 1000;
    }

    /* Cộng `minutes` phút làm việc vào from (bỏ ngoài giờ, nghỉ trưa, ngày nghỉ).
       Trả số ms; null nếu from sai, cấu hình sai hoặc không tìm thấy ngày làm việc trong MAX_DAYS. */
    function addWorkMinutes(from, minutes, cfg) {
        var a = DateUtil.toMillis(from);
        var c = prepare(cfg);
        if (a === null || !c.valid) {
            return null;
        }
        var left = Math.max(0, minutes) * 60000;
        var day = DateUtil.startOfDay(a);
        var n, i, list, base, s, e;

        for (n = 0; n < MAX_DAYS; n++) {
            base = day.valueOf();
            list = c.sessions[day.day()];
            if (list.length && !c.holidaySet[base]) {
                for (i = 0; i < list.length; i++) {
                    s = Math.max(base + list[i].from * 1000, a);
                    e = base + list[i].to * 1000;
                    if (e > s) {
                        if (left <= e - s) {
                            return s + left;
                        }
                        left -= e - s;
                    }
                }
            }
            day.add(1, "day");
        }
        return null;
    }

    function isActive(row, cfg) {
        var states = cfg.activeStates;
        return !states || !states.length || states.indexOf(row[cfg.statusField || "status"]) !== -1;
    }

    /* Kết quả SLA của một hồ sơ, null nếu không hiển thị SLA.
       { status, deadline (Date, red), warningAt (Date, yellow),
         remainingMinutes, overMinutes, progress (0-100 | null) } */
    function compute(row, cfg, now) {
        if (!row || !cfg || !prepare(cfg).valid || !isActive(row, cfg)) {
            return null;
        }
        var red = DateUtil.toMillis(row[cfg.redField || "redFlagDate"]);
        var yellow = DateUtil.toMillis(row[cfg.yellowField || "yellowFlagDate"]);
        if (red === null || yellow === null) {
            return null;
        }
        var t = DateUtil.toMillis(now || DateUtil.now());

        var status, remaining = 0, over = 0;
        if (t > yellow && t < red) {
            status = "warning";
            remaining = workSeconds(t, red, cfg);
        } else if (red < t) {
            status = "overdue";
            over = workSeconds(red, t, cfg);
        } else {
            status = "ok";
            remaining = workSeconds(t, red, cfg);
        }

        /* Tiến độ (tuỳ chọn): % giờ làm việc đã dùng từ lúc bắt đầu task đến hạn */
        var progress = null;
        var start = cfg.startField ? DateUtil.toMillis(row[cfg.startField]) : null;
        if (start !== null && start < red) {
            var total = workSeconds(start, red, cfg);
            progress = status === "overdue" || total <= 0
                ? 100
                : Math.max(0, Math.min(100, Math.round((total - remaining) / total * 100)));
        }

        return {
            status: status,
            deadline: new Date(red),
            warningAt: new Date(yellow),
            remainingMinutes: remaining / 60,
            overMinutes: over / 60,
            progress: progress
        };
    }

    /* Hạn SLA (ms) để sort; null nếu hồ sơ không thuộc diện tính SLA. */
    function deadlineOf(row, cfg) {
        if (!row || !cfg || !isActive(row, cfg)) {
            return null;
        }
        return DateUtil.toMillis(row[cfg.redField || "redFlagDate"]);
    }

    /* Thời lượng gọn, tối đa 2 đơn vị: 45p | 3g 20p | 2n 3g | 125n.
       1 ngày (n) = tổng giờ làm việc của ngày dài nhất trong workingHours. */
    function formatDuration(minutes, cfg) {
        var perDay = cfg ? prepare(cfg).perDayMinutes : 0;
        perDay = perDay > 0 ? perDay : 480;
        var m = Math.max(0, Math.round(minutes));
        var d = Math.floor(m / perDay);
        var h = Math.floor((m - d * perDay) / 60);
        var mm = Math.round(m - d * perDay - h * 60);
        if (d >= 10) { return d.toLocaleString() + "n"; }
        if (d > 0) { return d + "n" + (h ? " " + h + "g" : ""); }
        if (h > 0) { return h + "g" + (mm ? " " + mm + "p" : ""); }
        return mm + "p";
    }

    return {
        compute: compute,
        deadlineOf: deadlineOf,
        workSeconds: workSeconds,
        addWorkMinutes: addWorkMinutes,
        isDayOff: isDayOff,
        formatDuration: formatDuration
    };
})(DateUtil);
