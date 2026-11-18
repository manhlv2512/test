/* Hằng số dùng chung của màn hình giải ngân (ES5). */
var DISB_CONSTANTS = {
    /* Mã quyền (kiểm tra theo cơ chế permission/route hiện có). */
    PERMISSIONS: {
        QUEUE_VIEW: "TRANSACTION_DISBURSEMENT_QUEUE_VIEW",
        CREATE: "TRANSACTION_DISBURSEMENT_CREATE",
        EXPORT: "TRANSACTION_DISBURSEMENT_EXPORT"
    },
    /* Mã lỗi BE (đặt tạm, thay bằng mã thật khi có tài liệu API). */
    ERRORS: {
        FORBIDDEN_BRANCH: "DISB_403"
    },
    CONFIG_URL: "table-config.json",
    /* Bấm Mã GNTD: sau mỗi lần mở chi tiết, bỏ qua mọi click Mã GNTD tiếp theo trong khoảng này (ms) */
    DETAIL_CLICK_LOCK_MS: 1000,
    MESSAGES: {
        NO_DETAIL_URL: "Chưa cấu hình link chi tiết",
        NO_CREATE_TYPES: "Không có loại giao dịch khả dụng",
        NO_BRANCH: "Bạn chưa được phân quyền ĐVKD",
        UNSAFE_URL: "Link không hợp lệ"
    }
};
