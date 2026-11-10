/* Tính SLA theo giờ làm việc ở client (ES5, hàm thuần, không phụ thuộc DOM).
   Cấu hình xem mục "sla" trong table-config.json.

   DisbSla.compute(row, cfg, now) -> null (không tính) hoặc
     { deadline: Date, status: "ok"|"warning"|"overdue",
       usedMinutes, remainingMinutes, overMinutes, slaMinutes }
   Thời gian tính theo giờ local của trình duyệt (cfg.timezone chỉ để ghi chú). */
var DisbSla = (function () {
    var MAX_DAYS = 400; /* chặn vòng lặp vô hạn khi cấu hình sai */

    function pad(n) {
        return n < 10 ? "0" + n : String(n);
    }

    function dayKey(d) {
        return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    }

    function toMinutes(hhmm) {
        var p = String(hhmm).split(":");
        return (+p[0]) * 60 + (+p[1] || 0);
    }

    function atMinutes(day, minutes) {
        return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minutes, 0, 0);
    }

    function inList(list, value) {
        var i;
        for (i = 0; list && i < list.length; i++) {
            if (list[i] === value) {
                return true;
            }
        }
        return false;
    }

    function isWorkingDay(day, cfg) {
        var key = dayKey(day);
        if (inList(cfg.workingWeekends, key)) {
            return true;
        }
        if (inList(cfg.holidays, key)) {
            return false;
        }
        return inList(cfg.workingDays, day.getDay());
    }

    /* Các khung giờ làm việc của một ngày (đã sort), dạng [{from: Date, to: Date}]. */
    function windowsOf(day, cfg) {
        if (!isWorkingDay(day, cfg)) {
            return [];
        }
        var out = [];
        var hours = cfg.workingHours || [];
        var i;
        for (i = 0; i < hours.length; i++) {
            out.push({
                from: atMinutes(day, toMinutes(hours[i].from)),
                to: atMinutes(day, toMinutes(hours[i].to))
            });
        }
        out.sort(function (a, b) { return a.from - b.from; });
        return out;
    }

    /* Thời điểm làm việc sớm nhất >= date. Trả về { at: Date, end: Date } (end = hết khung hiện tại). */
    function nextWorkMoment(date, cfg) {
        var day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        var n, i, wins;
        for (n = 0; n < MAX_DAYS; n++) {
            wins = windowsOf(day, cfg);
            for (i = 0; i < wins.length; i++) {
                if (date < wins[i].to) {
                    return { at: date > wins[i].from ? date : wins[i].from, end: wins[i].to };
                }
            }
            day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
        }
        return null;
    }

    /* Cộng `minutes` phút làm việc vào start. */
    function addWorkMinutes(start, minutes, cfg) {
        var cur = nextWorkMoment(start, cfg);
        var remaining = minutes;
        var avail;
        while (cur) {
            avail = (cur.end - cur.at) / 60000;
            if (remaining <= avail) {
                return new Date(cur.at.getTime() + remaining * 60000);
            }
            remaining -= avail;
            cur = nextWorkMoment(cur.end, cfg);
        }
        return null;
    }

    /* Số phút làm việc trong khoảng [a, b). */
    function workMinutesBetween(a, b, cfg) {
        var total = 0;
        var cur = nextWorkMoment(a, cfg);
        var segEnd;
        while (cur && cur.at < b) {
            segEnd = cur.end < b ? cur.end : b;
            total += (segEnd - cur.at) / 60000;
            cur = nextWorkMoment(cur.end, cfg);
        }
        return total;
    }

    function slaMinutesOf(taskCode, cfg) {
        var tasks = cfg.tasks || {};
        var t = tasks[taskCode] || tasks.DEFAULT;
        return t && typeof t.minutes === "number" ? t.minutes : null;
    }

    /* "1g 20p" / "35p" */
    function formatMinutes(total) {
        var m = Math.round(total);
        var h = Math.floor(m / 60);
        var r = m % 60;
        return h > 0 ? h + "g " + pad(r) + "p" : r + "p";
    }

    function compute(row, cfg, now) {
        if (!row || !cfg) {
            return null;
        }
        var taskCode = row[cfg.taskField];
        var startValue = row[cfg.startField];
        if (inList(cfg.doneStates, taskCode) || !startValue) {
            return null;
        }
        var start = startValue instanceof Date ? startValue : parseDateTime(startValue);
        var minutes = slaMinutesOf(taskCode, cfg);
        if (!start || minutes === null) {
            return null;
        }
        now = now || new Date();

        var deadline = addWorkMinutes(start, minutes, cfg);
        if (!deadline) {
            return null;
        }
        var used = workMinutesBetween(start, now, cfg);
        var ratio = typeof cfg.warningRatio === "number" ? cfg.warningRatio : 0.8;
        var status = "ok";
        var over = 0;
        if (now > deadline) {
            status = "overdue";
            over = workMinutesBetween(deadline, now, cfg);
        } else if (used >= minutes * ratio) {
            status = "warning";
        }
        return {
            deadline: deadline,
            status: status,
            slaMinutes: minutes,
            usedMinutes: used,
            remainingMinutes: Math.max(0, minutes - used),
            overMinutes: over
        };
    }

    function parseDateTime(text) {
        var m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(String(text || ""));
        return m ? new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)) : null;
    }

    return {
        compute: compute,
        addWorkMinutes: addWorkMinutes,
        workMinutesBetween: workMinutesBetween,
        formatMinutes: formatMinutes
    };
})();
