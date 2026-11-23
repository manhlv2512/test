# Yêu cầu chức năng: Danh sách giao dịch hậu kiểm giải ngân

## 1. Mục tiêu

Màn hình danh sách giao dịch hậu kiểm (HK) giải ngân, dùng cùng layout, component (`js-table`) và style với `/transactions/disb`.

- Dữ liệu lấy từ `SP_GET_HK_TRANSACTION_PAGING` (bảng `HKCN_TRANSACTION`), phân trang, lọc và sort phía server.
- Cột **SLA** cảnh báo theo hạn hậu kiểm bằng cờ xanh / vàng / đỏ (mục 6).
- Giữ ES5, không `eval`, cấu hình bảng nằm trong `table-config.json`.

## 2. Cấu trúc thư mục

```text
transactions/
├── disb/                              # dùng chung: date-util.js, constants.js, disb-util.js, disb.css
└── hk/
    ├── index.html                     # trang, runtime (renderers, handlers, optionsProviders), mock data + mock SP
    ├── table-config.json              # cột, bộ lọc, sort, statusBadge, sla
    ├── hk-sla.css                     # style cột SLA hậu kiểm (.hk-sla-*), tách riêng với SLA giải ngân
    ├── SP_GET_HK_TRANSACTION_PAGING.sql
    ├── SP_GET_HK_SELECTION_CONFIG.sql # danh mục loại giao dịch cấp 1, trạng thái
    └── spec.md
```

Thứ tự nạp CSS: `table.min.css` → `disb.css` → `hk-sla.css`. Thứ tự nạp script: jQuery → jQuery UI → Select2 → `table.min.js` → moment → `date-util.js` → `constants.js` → `disb-util.js`. Màn HK **không** dùng `disb-sla.js` và class `.disb-sla-*`, vì SLA hậu kiểm tính theo ngày lịch (không theo giờ làm việc) và có style riêng; sửa SLA màn này không ảnh hưởng màn giải ngân.

## 3. Nguồn dữ liệu

### 3.1 Request (`P_JSON_OBJECT` của SP)

```json
{
  "page": 1,
  "pageSize": 10,
  "sort": { "field": "taskStartTime", "type": "DESC" },
  "filters": {
    "keyword": "GNCN441",
    "branch": "441,360",
    "transactionType1": "Giaingankhoanvay",
    "status": "CHO_XU_LY,CHO_BO_SUNG",
    "date_from": "2026-11-01",
    "date_to": "2026-11-30"
  }
}
```

`js-table` không gửi các filter rỗng. SP chuẩn hoá: `page`, `pageSize` lấy phần nguyên và tối thiểu 1 (mặc định 1 và 10); chuỗi rỗng coi như không lọc.

### 3.2 Response

BE trả `{ error, total, count, lists }` như màn giải ngân. `lists` giữ nguyên alias Oracle của SP, client đổi sang camelCase bằng `DisbUtil.normalizeRows` (`TRANSACTION_TYPE1_NAME` → `transactionType1Name`).

| Alias SP (cột bảng) | Field client | Dùng cho |
|---|---|---|
| `GNTD_CODE` | `gntdCode` | cột Mã GNTD (link chi tiết) |
| `PDTD_CODE` | `pdtdCode` | dòng PDTD trong cột Thông tin giao dịch |
| `TRANSACTION_TYPE1_NAME` | `transactionType1Name` | cột Thông tin giao dịch |
| `BRANCH_CODE` | `branchCode` | cột ĐVKD |
| `CUSTOMER_CODE`, `CUSTOMER_NAME` | `customerCode`, `customerName` | cột Khách hàng (mã KH / tên KH) |
| `STATUS` (`PA_STATUS`), `STATUS_NAME` | `status`, `statusName` | cột Trạng thái (badge), SLA |
| `PA_EXPIRY_DATE`, dạng `YYYY-MM-DD` | `paExpiryDate` | cột Thời điểm hậu kiểm, SLA |
| `ASSIGN_USER` (`USER_ASSIGN`) | `assignUser` | cột User phân công |
| `PROCESS_USER` (`USER_PA`) | `processUser` | cột User xử lý |
| `TASK_START_TIME` (`SUBMIT_DATE`), dạng `YYYY-MM-DD HH24:MI:SS` | `taskStartTime` | cột Thời điểm tiếp nhận |

SP còn trả các cột chưa hiển thị: `ID`, `TRANSACTION_FLOW(_NAME)`, `TRANSACTION_TYPE1/2/3`, `AMOUNT`, `GROUP_PROCESS`, `GN_APPROVAL_BY`, `GN_APPROVAL_DATE`, `CREATED_AT`, `UPDATED_BY`, `MODIFIED_AT`.

Ở lần tải dữ liệu đầu tiên, trang so field mà config cần (cột, `sla`, `statusBadge`, field dùng trong renderer) với dòng đầu. Thiếu field nào thì ghi log và hiện Toast "Sai tên field", kèm alias SP cần trả.

### 3.3 Danh mục

`SP_GET_HK_SELECTION_CONFIG` trả hai cursor `P_TRANSACTION_TYPE` và `P_STATUS` (scope `HKCN_STATUS`), cột `VALUE`, `LABEL`. Catalog của trang nhận `{ code, name }`, nên BE đổi `VALUE` → `code`, `LABEL` → `name`. Response mỗi API: `{ "error": null, "lists": [ { "code": "CHO_XU_LY", "name": "HK - Chờ xử lý" } ] }`.

## 4. Bộ lọc

| Nhãn | name | SP xử lý |
|---|---|---|
| Từ khoá | `keyword` | `UPPER(cột) LIKE '%' \|\| UPPER(keyword) \|\| '%'` trên `GNTD_CODE`, `PDTD_CODE`, `CUSTOMER_CODE`, `CUSTOMER_NAME`, `USER_ASSIGN` |
| ĐVKD | `branch` | danh sách mã cách nhau dấu phẩy (SP bỏ dấu cách). Rỗng = không lọc, nên BE phải tự truyền ĐVKD được phân quyền (mục 7) |
| Loại giao dịch cấp 1 | `transactionType1` | `TRANS_LEVEL_CODE_1 = transactionType1` |
| Trạng thái | `status` (multiple, `joinWith: ","`) | `PA_STATUS` thuộc danh sách |
| Thời điểm | `date` (daterange → `date_from`, `date_to`) | `NVL(PA_EXPIRY_DATE, CREATED_DATE)` từ 00:00 ngày `date_from` đến hết ngày `date_to` |

## 5. Cột và sort

Cột (theo `table-config.json`): STT, SLA, Mã GNTD, Thông tin giao dịch, ĐVKD, Khách hàng, Trạng thái, Thời điểm hậu kiểm (sort được), User phân công, User xử lý, Thời điểm tiếp nhận (sort được, mặc định DESC). Màu badge trạng thái theo `statusBadge.tones`: Chưa hậu kiểm `default`, Chờ xử lý và Chờ bổ sung `orange`, Hoàn thành `green`.

| `sort.field` gửi lên | SP sort theo |
|---|---|
| `taskStartTime` | `NVL(SUBMIT_DATE, CREATED_DATE)` |
| `paExpiryDate` | không có trong danh sách của SP nên về `createdDate`, tức `PA_EXPIRY_DATE` (kết quả đúng nhờ giá trị mặc định, xem mục 9) |
| `null` (bỏ sort) hoặc giá trị khác | `createdDate` DESC, tức `PA_EXPIRY_DATE` DESC |
| `_sla` | SP chưa có `CASE`, chỉ còn khoá phụ |

Khoá phụ luôn có: `CREATED_DATE DESC, ID DESC`. `type` khác `ASC`/`DESC` thì dùng `DESC`.

## 6. SLA hậu kiểm (cờ xanh / vàng / đỏ)

### 6.1 Quy tắc

Chỉ áp dụng cho các trạng thái **chưa hoàn thành**: `CHUA_HAU_KIEM`, `CHO_XU_LY`, `CHO_BO_SUNG` (`sla.activeStates`). Trạng thái `HOAN_THANH` để trống ô SLA.

Gọi `n` = **Thời điểm hậu kiểm** (`paExpiryDate`) − **hôm nay**, tính theo ngày lịch: bỏ giờ phút, không trừ thứ 7, chủ nhật hay ngày lễ.

| Cờ | Điều kiện | Chữ hiển thị | Icon |
|---|---|---|---|
| Xanh | `n > 3`, tức hôm nay < hạn − 3 ngày | "Còn n ngày" | `fa-clock` |
| Vàng | `0 ≤ n ≤ 3` | "Còn n ngày"; `n = 0` hiện "Hạn hôm nay" | `fa-hourglass-half` |
| Đỏ | `n < 0`, tức hôm nay > hạn | "Quá \|n\| ngày" | `fa-exclamation-circle` |

Ví dụ, hôm nay là 20/11/2026:

| Thời điểm hậu kiểm | n | Kết quả |
|---|---|---|
| 25/11/2026 | 5 | Xanh, "Còn 5 ngày" |
| 24/11/2026 | 4 | Xanh, "Còn 4 ngày" |
| 23/11/2026 | 3 | Vàng, "Còn 3 ngày" |
| 21/11/2026 | 1 | Vàng, "Còn 1 ngày" |
| 20/11/2026 | 0 | Vàng, "Hạn hôm nay" |
| 19/11/2026 | −1 | Đỏ, "Quá 1 ngày" |
| bất kỳ, trạng thái Hoàn thành | | trống |
| thiếu hoặc sai định dạng | | trống |

Cách hiểu yêu cầu gốc: yêu cầu ghi "thời gian hk < today − 3 → xanh, today − thời gian hk ≤ 3 → vàng, today > thời gian hk → đỏ". Nếu đọc đúng từng chữ, hai điều kiện đầu chồng lên điều kiện đỏ (ví dụ hạn đã qua 5 ngày thoả cả điều kiện xanh lẫn đỏ). Spec này hiểu là: còn hơn 3 ngày thì xanh, còn từ 0 đến 3 ngày thì vàng, quá hạn thì đỏ. Hai mốc biên cần nghiệp vụ xác nhận: còn đúng 3 ngày là **vàng**; hạn là hôm nay là **vàng** (chưa quá hạn).

### 6.2 Cấu hình (`sla` trong `table-config.json`)

```json
"sla": {
  "statusField": "status",
  "activeStates": ["CHUA_HAU_KIEM", "CHO_XU_LY", "CHO_BO_SUNG"],
  "dueField": "paExpiryDate",
  "yellowDays": 3
}
```

| Thuộc tính | Mặc định | Ý nghĩa |
|---|---|---|
| `statusField` | `status` | Field chứa mã trạng thái. |
| `activeStates` | | Các trạng thái có SLA (các trạng thái chưa hoàn thành). Thêm trạng thái mới chưa hoàn thành thì bổ sung vào đây. Mảng rỗng = mọi trạng thái đều có SLA. |
| `dueField` | `paExpiryDate` | Field ngày hạn hậu kiểm. |
| `yellowDays` | `3` | Còn từ 0 đến `yellowDays` ngày thì cờ vàng. Không phải số hoặc âm thì dùng 3 và ghi log. |

Bỏ mục `sla` khỏi config thì cột SLA luôn trống.

### 6.3 Code (`index.html`)

- `computeSla(row, cfg, today)` trả `{ status, days, due }`, với `status` là `ok` (xanh), `warning` (vàng), `overdue` (đỏ); trả `null` khi không tính SLA. `days` là `n` ở mục 6.1.
- `slaRenderer` gọi `computeSla` với hôm nay = `DateUtil.startOfDay(DateUtil.now())`, dùng class `.hk-sla-ok` / `.hk-sla-warning` / `.hk-sla-overdue` trong `hk-sla.css`: nhãn bo tròn chữ trắng, nền cùng màu badge trạng thái qua biến của `table.css` (`--badge-success-bg` xanh lá, `--badge-warning-bg` cam cho cờ vàng, `--badge-danger-bg` đỏ), không có thanh tiến độ. Tooltip: "Hạn hậu kiểm: dd/mm/yyyy".
- Độ rộng cột: cột `_sla` có `className` `hk-col-sla` (`hk-sla.css`: `width: 1%`, nhãn `min-width: 106px`), nên cột co vừa nhãn "Hạn hôm nay" và giữ 130px ở mọi độ rộng màn hình, không đổi khi chuyển trang.
- "Hôm nay" lấy theo đồng hồ máy người dùng, tính lúc render từng trang. Qua nửa đêm mà không tải lại thì cờ chưa đổi.
- Cột SLA chưa sort được. Nếu cần, SP sort `_sla` theo `PA_EXPIRY_DATE`, vì thứ tự cờ trùng thứ tự hạn.

## 7. Phân quyền ĐVKD

- `getPermissions` trả `{ error, allowBranchs, visibleConfig }`. Ô chọn ĐVKD chỉ gồm `allowBranchs`.
- BE kiểm tra lại: `branch` gửi lên có mã ngoài `allowBranchs` thì trả `error` mã `DISB_403` (`DISB_CONSTANTS.ERRORS.FORBIDDEN_BRANCH`), không trả dữ liệu.
- Không chọn ĐVKD: BE truyền `allowBranchs` (nối bằng dấu phẩy) vào `branch` của SP, vì SP coi `branch` rỗng là lấy mọi ĐVKD. `allowBranchs` rỗng thì trả danh sách rỗng.
- Nút Tải xuống hiện khi `visibleConfig.exportData === true`; export gọi `getAllData` (cùng filter, `pageSize = total`).

## 8. Dữ liệu mock (`index.html`)

- `HKCN_TRANSACTION`: mảng dòng theo tên cột của bảng, cột DATE lưu số ms.
- `mockSpGetHkTransactionPaging(json)` chạy theo đúng thứ tự trong SP: WHERE → COUNT (`P_TOTAL`) → ORDER BY → OFFSET/FETCH → SELECT với alias và định dạng ngày như SP. Sửa SP thì sửa theo ở đây.
- `transactionService.getHkTransactionPaging` giả lập BE (mục 7) rồi gọi mock SP.
- Sửa `DEMO_CONFIG` rồi F5; URL `?rows=5000` ghi đè số dòng.

| Key | Mặc định | Ý nghĩa |
|---|---|---|
| `rows` | 10000 | Số hồ sơ. |
| `seed` | 2027 | Giữ seed thì F5 ra cùng bộ dữ liệu. |
| `gapMinutes` | 10 | `CREATED_DATE` cách nhau 10 phút, mới nhất ở đầu. |
| `maxSubmitMinutes` | 120 | `SUBMIT_DATE` = `CREATED_DATE` + 0..120 phút, không quá hiện tại. |
| `paExpiryDays` | `[-3, 7]` | `PA_EXPIRY_DATE` = ngày tạo + ngẫu nhiên −3..7 ngày (âm: hồ sơ về đã quá hạn), để trang đầu có đủ 3 màu cờ. |
| `statusWeights` | 35 / 30 / 15 / 20 | Tỷ lệ Chưa hậu kiểm / Chờ xử lý / Chờ bổ sung / Hoàn thành. |
| `unsubmittedStates` | `["CHUA_HAU_KIEM"]` | Trạng thái chưa tiếp nhận: `SUBMIT_DATE`, `USER_PA`, `UPDATED_BY`, `UPDATED_DATE` để null. |
| `amountRanges` | 3 loại giao dịch | `AMOUNT` (VND, tròn triệu); loại khác để null. |
| `nameWords` | `[3, 5]` | Số chữ của tên KH. |

Trạng thái mock không phụ thuộc tuổi hồ sơ, nên càng về các trang sau (hồ sơ cũ) càng nhiều cờ đỏ.

## 9. Việc còn mở

| # | Hiện trạng | Đề xuất |
|---|---|---|
| 1 | Placeholder ô Từ khoá ghi "user xử lý" nhưng SP tìm theo `USER_ASSIGN` (User phân công). | Đổi placeholder, hoặc SP tìm thêm `USER_PA`. |
| 2 | Sort cột Thời điểm hậu kiểm (`paExpiryDate`) chạy đúng chỉ nhờ SP về mặc định `createdDate`, mà nhánh này lại sort `PA_EXPIRY_DATE`. | Thêm `paExpiryDate` vào danh sách sort của SP với `CASE` riêng. |
| 3 | `STATUS_NAME` join `GNCN_STATUS`, còn danh mục trạng thái lấy từ `GNCN_CONFIG_COMMONS` scope `HKCN_STATUS`. | Join cùng nguồn với danh mục, tránh tên trạng thái null hoặc lệch. |
| 4 | Cột Thời điểm hậu kiểm không có renderer nên hiện `YYYY-MM-DD`. | Thêm renderer `DD/MM/YYYY` nếu cần thống nhất với cột Thời điểm tiếp nhận. |
| 5 | `amountDisplay` có trong config nhưng chưa cột nào dùng; SP đang comment `CURRENCY`. | Bỏ khỏi config, hoặc thêm cột số tiền. |
| 6 | Config chưa có mục `detail`, bấm Mã GNTD báo "Chưa cấu hình link chi tiết". | Bổ sung `detail.url`, `detail.target`. |
| 7 | Comment đầu SP vẫn mô tả màn giải ngân (`flow`, `processGroup`, trạng thái `GNCN_*`); `V_HIDE_FINISHED`, `C_FINISHED_STATUS` không còn dùng. | Dọn comment và biến thừa. |
| 8 | `SP_GET_HK_SELECTION_CONFIG` trả `VALUE`/`LABEL`, catalog của trang cần `{ code, name }`. | BE đổi key (mục 3.3). |
| 9 | Tên trạng thái mock "HK- Hoàn thành" thiếu dấu cách (tên thật lấy từ DB). | Kiểm tra dữ liệu `HKCN_STATUS`. |

## 10. Tiêu chí nghiệm thu

- Mỗi dòng trạng thái Chưa hậu kiểm, Chờ xử lý, Chờ bổ sung có cờ đúng bảng 6.1; dòng Hoàn thành để trống.
- Mốc biên: còn 4 ngày xanh, còn 3 ngày vàng, hạn hôm nay vàng ("Hạn hôm nay"), quá 1 ngày đỏ.
- Đổi `yellowDays` trong config thì ngưỡng vàng đổi theo, không sửa code.
- Dữ liệu đúng alias SP thì không có Toast "Sai tên field".
- Lọc, sort, phân trang, export cho kết quả như SP (mục 4, 5).
