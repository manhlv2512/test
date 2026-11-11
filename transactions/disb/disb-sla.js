var WEEK_DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
var currentDate = new Date();
//tw.local.sla = calculateSlaResidual(tw.local.redFlagDate, currentDate)

var mapTransType1 = JSON.parse(tw.local.mapTransType1);
var mapTransType2 = JSON.parse(tw.local.mapTransType2);
var mapStatus = JSON.parse(tw.local.mapStatus);
var mapTransFlow = JSON.parse(tw.local.mapTransFlow);

if (tw.local.dataTable && tw.local.dataTable.length > 0) {
    for (var i = 0; i < tw.local.dataTable.length; i++) {
        var record = tw.local.dataTable[i];
        record.displayBranch = displayCodeName(record.branchCode, record.branchName);
        record.displayCustomer = displayCodeName(record.customerCode, record.customerName);
        record.transactionType1Display = mapTransType1[record.transactionType1] || record.transactionType1;
        record.transactionType2Display = mapTransType2[record.transactionType2] || record.transactionType2;
        record.statusName = mapStatus[record.status] || record.status;
        record.transactionFlowName = mapTransFlow[record.transactionFlow] || record.transactionFlow;
        if (record.status == tw.epv.DB_STATUS_CODE.CHO_XU_LY) {
            if (record.yellowFlagDate && record.redFlagDate) {
                var deadlineSlaYellowFlagDate = record.yellowFlagDate;
                var deadlineSlaRedFlagDate = record.redFlagDate;

                if (deadlineSlaYellowFlagDate && deadlineSlaRedFlagDate && currentDate > deadlineSlaYellowFlagDate && currentDate < deadlineSlaRedFlagDate) {
                    var timeRemaining = calculateSlaResidual(deadlineSlaRedFlagDate, currentDate);
                    record.dangerSlaFlag = "NONE";
                    record.successSlaFlag = "NONE";
                    record.warningSlaFlag = "DEFAULT";
                    record.colorSlaDate = "warning";
                    timeRemaining = Math.abs(timeRemaining);
                    record.flagSlaDateDisplayText = "Còn " + Math.round(timeRemaining / 60) + "p";
                } else if (deadlineSlaRedFlagDate && deadlineSlaRedFlagDate < currentDate) {
                    var timeToo = calculateSlaResidual(currentDate, deadlineSlaRedFlagDate);
                    record.successSlaFlag = "NONE"
                    record.warningSlaFlag = "NONE"
                    record.dangerSlaFlag = "DEFAULT"
                    record.colorSlaDate = "danger";
                    timeToo = Math.abs(timeToo);
                    record.flagSlaDateDisplayText = "Quá " + Math.round(timeToo / 60) + "p";
                } else {
                    var timeRemaining = calculateSlaResidual(deadlineSlaRedFlagDate, currentDate);
                    record.warningSlaFlag = "NONE"
                    record.dangerSlaFlag = "NONE"
                    record.successSlaFlag = "DEFAULT";
                    record.colorSlaDate = "success";
                    timeRemaining = Math.abs(timeRemaining);
                    record.flagSlaDateDisplayText = "Còn " + Math.round(timeRemaining / 60) + "p";
                }
            } else {
                record.warningSlaFlag = "NONE"
                record.dangerSlaFlag = "NONE"
                record.successSlaFlag = "DEFAULT";
                record.colorSlaDate = "NONE";
            }

        } else {
            record.warningSlaFlag = "NONE"
            record.dangerSlaFlag = "NONE"
            record.successSlaFlag = "NONE";
            record.colorSlaDate = "NONE";
        }
        tw.local.dataTable[i] = record;
    }
}

//Kiem tra ngay nghi
function checkIsDayOff(currentDate) {
    // Kiem tra ngay holiday
    var isHoliday = tw.local.holidays.some(function (holiday) {
        return formatDate(holiday.ngayNghi) == formatDate(currentDate);
    });
    if (isHoliday) return true;
    //Kiem tra ngay nghi hang tuan(Sunday)
    var dayOfWeek = getDayOfWeek(currentDate);
    var hasWorkingTimeInDay = tw.local.workingHours.some(function (workingHour) {
        return workingHour.workday == dayOfWeek
    });
    if (!hasWorkingTimeInDay) return true;

    return false;
}

//Convert date to format yyyy-MM-dd
function formatDate(value) {
    var date = new Date(value);
    var strDate = date.getUTCFullYear()
        + "-" + ("00" + (date.getMonth() + 1)).slice(-2)
        + "-" + ("00" + date.getDate()).slice(-2);
    return strDate;
}

//Lay ngay trong tuan
function getDayOfWeek(date) {
    return WEEK_DAY[date.getDay()];
}

//Tính SLA còn dư
function calculateSlaResidual(deadlineSlaDate, additionalDate) {
    var sla = 0;
    var startDate = new Date(additionalDate);
    var startTime = startDate.getHours() * 60 * 60
        + startDate.getMinutes() * 60
        + startDate.getSeconds();
    var endDate = new Date(deadlineSlaDate);
    var totalTime = (endDate.getTime() - startDate.getTime()) / 1000;
    var idx = 0; // idx > 0 tinh time ngay cuoi cung
    var isFirstCheck = true;
    while (totalTime > 0) {
        if (checkIsDayOff(startDate)) {
            totalTime -= 86400;
        } else {
            var dayOfWeek = getDayOfWeek(startDate);
            var workingHours = tw.local.workingHours.filter(function (workingHour) {
                return workingHour.workday == dayOfWeek;
            }) || [];
            var workTimeOfDay = workingHours.reduce(function (total, workingHour) {
                return total + (+workingHour.workTime);
            }, 0);
            if (totalTime >= 86400 && !isFirstCheck) {
                totalTime -= 86400;
                sla += workTimeOfDay;
                idx--;
            } else {
                if (idx > 0) {
                    totalTime -= (86400 - startTime) + workingHours[0].startTimeValue; // trừ time tu cuoi ngay hm trc den dau ngay hm sau
                    startTime = workingHours[0].startTimeValue;
                }
                for (var i = 0; i < workingHours.length; i++) {
                    var workingHour = workingHours[i];
                    var workTime = +workingHour.workTime;
                    if (startTime <= workingHour.endTimeValue) {
                        if (startTime < workingHour.startTimeValue) {
                            totalTime -= workingHour.startTimeValue - startTime;
                            startTime = workingHour.startTimeValue;
                        }
                        var workTimeOfSession = workingHour.endTimeValue - startTime; //Thoi gian lm viec con lai trong buoi
                        var timeResidual = totalTime - workTimeOfSession;// thoi gian con du sau khi lm het buoi lm viec
                        if (timeResidual > 0) {
                            totalTime -= workTimeOfSession;
                            sla += workTimeOfSession;
                            startTime = workingHour.endTimeValue; // gan startTime = endTime cuoi ngay
                        } else {
                            sla += totalTime;
                            totalTime = 0;
                            break;
                        }
                    }
                }
            }
            idx++;
        }
        startDate.setDate(startDate.getDate() + 1);
        isFirstCheck = false;
    }
    return sla;
}

function displayCodeName(code, name) {
    var arr = [];
    if (code) arr.push(code);
    if (name) arr.push(name);
    return arr.join("<br/>")
}

var workingHours = [
    {
        "stt": "1",
        "id": "WD001",
        "workday": "Monday",
        "startTime": "08:00",
        "endTime": "17:30",
        "workTime": "8.5",
        "workdayValue": 2,
        "startTimeValue": 800,
        "endTimeValue": 1730
    }
]

var holidays = [
    {
        date: string,
        desc: string
    }
];