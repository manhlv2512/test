# Yêu cầu chức năng: Danh sách giao dịch giải ngân

## 1. Mục tiêu

Chuyển màn hình **Danh sách giao dịch giải ngân** (giao diện cũ, xem `example.png`) sang giao diện mới giống `/transactions/block`, xây dựng trên component `js-table`. Điểm khác biệt chính:

- Các action (Khởi tạo, Tải xuống) chuyển từ header xuống toolbar của bảng.

- Dữ liệu có **phân trang phía server** (page, pageSize, sort, filters).
- Nút **Khởi tạo** mở popup cho chọn **Loại giao dịch cấp 1** dạng **thẻ button lớn**. Chọn một thẻ thì mở link tạo giao dịch, kèm tham số là loại giao dịch cấp 1 đã chọn.
- URL tạo giao dịch và danh sách loại giao dịch cấp 1 đều khai báo trong config JSON.

Tham chiếu giao diện cũ: `example.png`.

## 2. Phạm vi và ràng buộc

- Clone cấu trúc từ `/transactions/block`: layout, tìm kiếm, phân trang, sort, table component, export, loading, empty state, error handling.
- Route: `/transactions/disb` (hoặc theo convention hiện có).
- Tạo service riêng, không dùng lại API của block transaction. Ví dụ: `transactionService.getDisbursementQueue()`.
- Giữ nguyên ES5, không `eval`, theme tím qua CSS variables, hỗ trợ trình duyệt hiện đại (không IE11).
- Không ảnh hưởng module `/transactions/block`. Reuse `js-table`, không duplicate logic.

## 3. Cấu trúc thư mục

```text
transactions/
├── block/
└── disb/
    ├── index.html          # trang, runtime (renderers, handlers, optionsProviders)
    ├── table-config.json   # cấu hình table, search, buttons, create
    ├── constants.js        # mã quyền, URL, trạng thái
    ├── model.js            # mapping response API
    └── spec.md
```

## 4. Bố cục màn hình (theo example.png)

Giao diện mới dùng đúng layout của `/transactions/block` (component `js-table`), chỉ giữ lại nội dung (bộ lọc, cột) của màn hình cũ. Từ trên xuống:

1. **Header**: chỉ có tiêu đề "Danh sách giao dịch giải ngân". **Không còn nút** Tải xuống, Khởi tạo ở góc phải header như giao diện cũ.
2. **Form tìm kiếm**: các trường lọc ở mục 5, có nút **Đặt lại** và **Áp dụng**, style như `/transactions/block`.
3. **Toolbar của bảng** (ngay phía trên bảng, dưới form tìm kiếm): thống kê số bản ghi bên trái; các action bên phải:
   - **Khởi tạo** (icon `+`, màu tím), mở popup chọn loại giao dịch (mục 7).
   - **Tải xuống** (Export Excel), gọi `getAllData`.
   Cả hai khai báo trong `buttons` của `table-config.json` (có thể gộp vào dropdown "Thao tác" nếu cần gọn).
4. **Bảng dữ liệu**: style, hover, chọn hàng, cột thao tác như `/transactions/block`.
5. **Chân bảng**: chọn page size (10/20/50/100) bên trái, phân trang (Previous, số trang, Next, Go to) bên phải.

Cấu hình toolbar:

```json
"buttons": [
  { "text": "Khởi tạo", "iconClass": "fas fa-plus", "handler": "openCreatePopup" },
  { "text": "Tải xuống", "iconClass": "fas fa-file-download", "className": "tr-btn-default", "handler": "exportExcel" }
]
```

## 5. Bộ lọc tìm kiếm

| Nhãn | name | Kiểu | Nguồn dữ liệu |
|------|------|------|---------------|
| Từ khoá | `keyword` | text | thay cho các ô nhập text riêng lẻ (xem bên dưới) |
| Loại giao dịch cấp 1 | `transactionType1` | select | `optionsProvider: transactionType1Options` |
| Phân luồng | `flow` | select | `optionsProvider: flowOptions` (API, mục 5.1) |
| Đơn vị kinh doanh | `branch` | select | `optionsProvider: branchOptions`, chỉ gồm ĐVKD user được phân quyền (mục 5.2) |
| Thời điểm từ | `dateFrom` | date | mặc định 1 tháng trước, format hiển thị `dd-mm-yy` |
| Thời điểm đến | `dateTo` | date | mặc định hôm nay |
| Trạng thái | `processState` | select (multiple, `joinWith: ","`) | `optionsProvider` |
| Nhóm xử lý | `processGroup` | select | `optionsProvider: processGroupOptions` |

Nguyên tắc: chỉ giữ riêng ô **select** và **date**. Mọi điều kiện dạng nhập text trong giao diện cũ (Mã GNTD, Mã PDTD, Mã khách hàng, Tên khách hàng, User xử lý) gộp vào **một ô Từ khoá** (`keyword`), ưu tiên tìm theo keyword.

- Placeholder gợi ý: "Mã GNTD, mã PDTD, mã/tên KH, user xử lý".
- Server tìm `keyword` (không phân biệt hoa/thường, khớp một phần) trên các cột: `gntdCode`, `pdtdCode`, `customerCode`, `customerName`, `processUser`.
- Ô Từ khoá đặt đầu tiên trong form, độ rộng lớn hơn các ô khác (khoảng 300-400px), nhấn Enter để tìm.

Cấu hình:

```json
{ "name": "keyword", "label": "Từ khoá", "type": "text", "width": 400,
  "placeholder": "Mã GNTD, mã PDTD, mã/tên KH, user xử lý" }
```

Ghi chú:
- Hai trường ngày có thể khai báo bằng một field `daterange` (`name_from`, `name_to`), format gửi lên server `yy-mm-dd`.
- Nút **Đặt lại** xoá filter và về trang 1. **Áp dụng** gửi filter và về trang 1.

### 5.1 Danh mục tải bất đồng bộ từ API

Các ô chọn **Phân luồng**, **Loại giao dịch cấp 1**, **Trạng thái**, **Nhóm xử lý** lấy danh sách từ API, không khai báo `options` cố định trong config.

| Ô chọn | Provider | API (mock) | Catalog key |
|--------|----------|-----|-------------|
| Phân luồng | `flowOptions` | `transactionService.getFlows` | `flows` |
| Loại giao dịch cấp 1 | `transactionType1Options` | `transactionService.getTransactionTypes` | `transactionTypes` |
| Trạng thái | `processStateOptions` | `transactionService.getProcessStates` | `processStates` |
| Nhóm xử lý | `processGroupOptions` | `transactionService.getProcessGroups` | `processGroups` |

Response mỗi API: `{ "error": null, "lists": [ { "code": "TT", "name": "Tập trung" } ] }`.

Luồng xử lý:
1. Bốn API được gọi **ngay khi load `index.html`**, song song và độc lập với tải config, phân quyền và dữ liệu bảng. View không chờ danh mục.
2. Bảng và form khởi tạo bình thường, các ô chọn tạm thời rỗng.
3. Mỗi provider là async: chờ API tương ứng rồi gọi `setOptions(list)`. `js-table` dựng lại `<option>` và cập nhật Select2 (`setFieldOptions`), giữ lựa chọn hiện tại nếu còn hợp lệ.
4. Mỗi API chỉ gọi một lần (cache trong `Catalog`). Provider gọi sau khi API đã trả về thì nhận dữ liệu ngay.
5. API lỗi: Toast lỗi, ô chọn đó để rỗng, các ô khác và bảng vẫn dùng được.

### 5.2 Giới hạn ĐVKD theo phân quyền

Danh sách ĐVKD của user hiện tại bị giới hạn theo phân quyền, ở cả danh sách chọn lẫn dữ liệu trả về.

- **Danh sách chọn (client):** `branchOptions` lấy từ `allowBranchs` trong object phân quyền (mục 9), BE trả về một lần khi load trang. Không dùng danh sách ĐVKD toàn hệ thống.
- **Mặc định:** user chỉ có một ĐVKD thì chọn sẵn và khoá ô chọn (`disabled`). Nhiều ĐVKD thì để trống, hiểu là "Tất cả ĐVKD được phép".
- **Khi không chọn ĐVKD:** client gửi `branch` rỗng, server tự giới hạn bằng danh sách ĐVKD của user (không trả về toàn bộ).
- **Server bắt buộc kiểm tra lại (không tin client):** `branch` gửi lên không thuộc danh sách được phép thì trả `error` (ví dụ `DISB_403`), không trả dữ liệu. Áp dụng cho cả search, export và xem chi tiết.
- **Không có ĐVKD nào được phép:** ô chọn trống, bảng hiển thị empty state kèm thông báo "Bạn chưa được phân quyền ĐVKD".
- **Lỗi tải phân quyền:** Toast lỗi, ô chọn ĐVKD để trống, các bộ lọc khác vẫn dùng được.

## 6. Bảng dữ liệu và phân trang

### 6.1 Cột

| Cột | field | Ghi chú |
|-----|-------|---------|
| STT | `_stt` | `sttRenderer`, tính theo `(page - 1) * pageSize + index + 1` |
| SLA | `_sla` | tính ở client (mục 6.3), `slaRenderer` hiển thị trạng thái hạn xử lý. **Sortable** theo hạn xử lý (mục 6.1.1). |
| Mã GNTD | `gntdCode` | cột riêng để dễ thao tác (copy, bấm). Link tím, bấm mở chi tiết (`openTransactionDetail`). |
| Loại giao dịch / PDTD | `transactionType1Name`, `pdtdCode` | `transactionRenderer`: dòng 1 loại giao dịch cấp 1, dòng 2 "PDTD: …". |
| ĐVKD | `branchCode` | căn giữa |
| Khách hàng | `customerCode`, `customerName` | `customerRenderer`: dòng 1 mã KH, dòng 2 tên KH |
| Trạng thái | `processStateName` | cho phép xuống dòng |
| User xử lý | `processUser` | user khởi tạo và chuyển phê duyệt hồ sơ |
| User phân công | `assignUser` | user được gợi ý xử lý hồ sơ |
| User lock | `lockUser` | |
| Phân luồng / Nhóm xử lý | `flowName`, `processGroup` | `flowGroupRenderer`: dòng 1 phân luồng, dòng 2 "Nhóm: …" (ẩn nếu trống) |
| Thời điểm tiếp nhận | `createdDate` | căn phải, format `dd/MM/yyyy HH:mm:ss`. **Sortable**, sort mặc định `DESC`. |
| Thao tác | | chỉ có **Log xử lý** |

Nguyên tắc gộp cột:
- Gộp các thông tin cùng nhóm nghĩa vào một ô nhiều dòng (dòng chính đậm thường, dòng phụ chữ nhỏ xám) để bảng gọn, không phải cuộn ngang.
- **Không gộp** User xử lý, User phân công, User lock vì khác ý nghĩa nghiệp vụ.
- Dòng phụ trống thì không hiển thị.
- Export (`getAllData`) vẫn xuất đủ từng field riêng.
- Mã GNTD **không gộp**: là mã thao tác chính (bấm mở chi tiết, copy, đối chiếu), để cột riêng dùng action link của `js-table`.

Danh sách cột cuối cùng theo response API giải ngân. Tên field ở trên là tên đề xuất.

### 6.1.1 Sort

Nghiệp vụ chỉ cần sort theo mốc thời gian, nên chỉ hai cột được sort:

| Cột | `sort.field` gửi lên | Ý nghĩa |
|-----|----------------------|---------|
| Thời điểm tiếp nhận | `createdDate` | Mặc định `DESC` (mới nhất trước), khai báo `"sort"` trong `table-config.json`. |
| SLA | `_sla` | Sort theo **hạn xử lý** (deadline). `ASC`: hồ sơ gấp/quá hạn lên đầu. |

- Hồ sơ không tính SLA (đã hoàn thành, thiếu thời điểm bắt đầu) có deadline rỗng và luôn nằm cuối, bất kể chiều sort.
- Sort phía server (dữ liệu phân trang). Với `_sla`, BE cần tính deadline theo cùng quy tắc mục 6.3 (hoặc lưu sẵn cột `slaDeadline`) rồi sort; client chỉ hiển thị.
- Mock trong `index.html` tính deadline bằng `DisbSla.addWorkMinutes` và cache trên từng dòng (`_slaDeadline`), lần sort SLA đầu tiên chậm hơn các lần sau.

### 6.2 Phân trang (server-side)

Request gửi lên service:

```json
{
  "page": 1,
  "pageSize": 10,
  "sort": { "field": "createdDate", "type": "DESC" },
  "filters": {
    "keyword": "GNCN4412",
    "transactionType1": "",
    "processState": "1,2",
    "dateFrom": "2026-10-07",
    "dateTo": "2026-11-07"
  }
}
```

Response của API giải ngân gồm 4 thuộc tính:

| Thuộc tính | Kiểu | Ý nghĩa |
|------------|------|---------|
| `error` | object / null | Thông tin lỗi. `null` hoặc không có nghĩa là thành công. Khi có lỗi thì chứa `code` và `message`. |
| `total` | number | Tổng số bản ghi thoả điều kiện (tất cả các trang), dùng cho phân trang. |
| `count` | number | Số bản ghi của trang hiện tại, tức độ dài `lists`. |
| `lists` | array | Danh sách bản ghi của trang hiện tại. |

Thành công:

```json
{
  "error": null,
  "total": 105,
  "count": 10,
  "lists": [ { "gntdCode": "GNCN441261107001", "pdtdCode": "2628344" } ]
}
```

Lỗi:

```json
{ "error": { "code": "DISB_001", "message": "Mô tả lỗi" }, "total": 0, "count": 0, "lists": [] }
```

Mapping sang `js-table`: component đọc `{ total, page, data }`, nên `searchFunction` (trong `model.js` hoặc service) chuyển đổi response trước khi gọi callback:

```javascript
function mapDisbResponse(request, res) {
    res = res || {};
    if (res.error) {
        Toast.error(res.error.message || "Có lỗi xảy ra", "Lỗi tải dữ liệu");
        return { total: 0, page: request.page, data: [] };
    }
    return {
        total: res.total || 0,
        page: request.page,
        data: res.lists || []
    };
}
```

- `count` dùng để hiển thị "Showing X to Y of N entries": `X = (page - 1) * pageSize + 1`, `Y = X + count - 1`. Nếu `count` thiếu thì lấy `lists.length`.
- Mặc định `pageSize = 10`, tuỳ chọn `[10, 20, 50, 100]`. Sort mặc định: `createdDate DESC`.
- Đổi page size thì về trang 1.
- `error` có giá trị: hiển thị Toast lỗi và bảng rỗng. `total = 0` (không lỗi): hiển thị empty state.
- Lỗi mạng hoặc HTTP khác 2xx cũng xử lý như `error` (Toast lỗi, bảng rỗng).

### 6.3 Tính SLA ở client

API không trả SLA. Client tính từ thời điểm bắt đầu task, thời gian SLA cấu hình theo từng task, lịch ngày làm việc và danh sách ngày nghỉ. Mọi tham số đều đọc từ config (mục `sla` trong `table-config.json`), không hard-code.

#### Cấu hình

```json
{
  "sla": {
    "timezone": "Asia/Ho_Chi_Minh",
    "workingDays": [1, 2, 3, 4, 5],
    "workingHours": [
      { "from": "08:00", "to": "12:00" },
      { "from": "13:30", "to": "17:30" }
    ],
    "holidays": ["2026-01-01", "2026-04-30", "2026-05-01", "2026-09-02"],
    "workingWeekends": [],
    "warningRatio": 0.8,
    "startField": "taskStartTime",
    "taskField": "processStateCode",
    "tasks": {
      "KHOI_TAO":   { "label": "GN - Khởi tạo",            "minutes": 120 },
      "HACH_TOAN":  { "label": "GN - Hạch toán",           "minutes": 60 },
      "DEFAULT":    { "label": "Mặc định",                 "minutes": 240 }
    },
    "doneStates": ["HOAN_THANH"]
  }
}
```

| Thuộc tính | Ý nghĩa |
|------------|---------|
| `timezone` | Múi giờ tính SLA. Mặc định theo trình duyệt nếu bỏ trống. |
| `workingDays` | Ngày làm việc trong tuần (0 = Chủ nhật, 1 = Thứ hai, ...). |
| `workingHours` | Các khung giờ làm việc trong ngày (có thể nhiều khung, ví dụ nghỉ trưa). |
| `holidays` | Ngày nghỉ lễ `yyyy-mm-dd`, không tính thời gian. |
| `workingWeekends` | (tuỳ chọn) Ngày cuối tuần làm bù, vẫn tính thời gian làm việc. |
| `warningRatio` | Tỷ lệ thời gian đã dùng để chuyển sang cảnh báo (0.8 = còn 20%). |
| `startField` | Field thời điểm bắt đầu task trong dòng dữ liệu. |
| `taskField` | Field xác định task/trạng thái hiện tại để tra `tasks`. |
| `tasks[code].minutes` | Thời gian SLA (phút làm việc) của task. Không có code thì dùng `DEFAULT`. |
| `doneStates` | Trạng thái đã hoàn thành: không tính SLA, ô để trống. |

#### Thuật toán

1. Bỏ qua dòng nếu `taskField` thuộc `doneStates` hoặc thiếu `startField`.
2. Tra `minutes` theo `tasks[row[taskField]]`, nếu không có thì lấy `DEFAULT`.
3. **Hạn xử lý (deadline)**: bắt đầu từ `start` (nếu ngoài giờ làm việc thì dời tới đầu khung giờ làm việc kế tiếp), cộng dần `minutes` chỉ trong các khung `workingHours` của ngày làm việc. Ngày không thuộc `workingDays`, hoặc thuộc `holidays` (trừ `workingWeekends`), thì bỏ qua cả ngày.
4. **Trạng thái** theo thời điểm hiện tại `now`:
   - `ok`: đã dùng dưới `warningRatio` thời gian SLA.
   - `warning`: đã dùng từ `warningRatio` đến hết hạn.
   - `overdue`: `now` vượt `deadline`; hiển thị số thời gian quá hạn.
5. Tính thời gian đã dùng và còn lại bằng phút làm việc (không tính đêm, nghỉ trưa, ngày nghỉ).

#### Hiển thị (`slaRenderer`)

- Màu chữ và icon theo trạng thái (không dùng badge nền): `ok` xanh lá `fa-clock`, `warning` vàng `fa-hourglass-half`, `overdue` đỏ `fa-exclamation-circle`.
- Dưới chữ là thanh tiến độ mảnh (4px) thể hiện % thời gian SLA đã dùng, tối đa 100%.
- Nội dung ngắn, tối đa 2 đơn vị, tính theo ngày làm việc (1n = tổng phút `workingHours`): "Còn 45p", "Còn 3g 20p", "Quá 2n 3g", từ 10 ngày trở lên chỉ hiện số ngày ("Quá 125n").
- Tooltip: hạn xử lý (`dd/MM/yyyy HH:mm`), SLA của task, thời gian đã dùng.
- Tính trong `renderer` mỗi lần render bảng; tuỳ chọn làm mới mỗi 60 giây để cập nhật badge.
- Có thể sort theo `deadline` nếu cần (sort ở client trên trang hiện tại; sort server-side cần BE hỗ trợ).

#### Tách module

- Logic tính nằm trong `sla.js` riêng (ES5, hàm thuần, không phụ thuộc DOM), nhận `(row, config, now)` và trả về `{ deadline, status, usedMinutes, remainingMinutes }`.
- `index.html` nạp `config.sla` cùng lúc với `config.detail` và `config.create`, truyền vào renderer.
- Dễ kiểm thử: các trường hợp qua đêm, qua cuối tuần, qua ngày lễ, bắt đầu ngoài giờ, task không có cấu hình.

#### Thông tin cần bổ sung

Các giá trị trong ví dụ trên là mẫu. Cần bạn cung cấp:
- Thời gian SLA cho từng task (mã task, số phút hoặc giờ).
- Danh sách ngày nghỉ lễ (và ngày làm bù nếu có).
- Khung giờ làm việc trong ngày và ngày làm việc trong tuần.
- Field nào là thời điểm bắt đầu task, field nào xác định task; trạng thái nào xem là đã hoàn thành.
- Ngưỡng cảnh báo (mặc định 80%).

## 7. Nút Khởi tạo: popup chọn loại giao dịch cấp 1

### 7.1 Hành vi

1. Bấm **Khởi tạo** trên toolbar của bảng (handler `openCreatePopup`) thì mở popup (SweetAlert2, cùng style với popup chi tiết eKYC) với tiêu đề "Chọn loại giao dịch".
2. Nội dung popup là lưới các **thẻ button lớn**, mỗi thẻ là một loại giao dịch cấp 1:
   - Icon (Font Awesome) ở trên, tên loại giao dịch bên dưới, mô tả ngắn (tuỳ chọn).
   - Lưới 3 cột, tự co về 2 hoặc 1 cột trên màn hình nhỏ.
   - Hover: viền và nền tím nhạt. Có focus ring và điều hướng được bằng bàn phím (Tab, Enter).
   - Thẻ `disabled` bị làm mờ, không bấm được (ví dụ khi user không có quyền).
3. Bấm một thẻ thì đóng popup và mở URL tạo giao dịch, trong đó tham số là mã loại giao dịch cấp 1 đã chọn.
4. Nút đóng (X) và phím Esc đóng popup mà không điều hướng.
5. Không có loại giao dịch nào thì hiển thị thông báo "Không có loại giao dịch khả dụng".

### 7.2 Cấu hình URL

Khai báo trong `table-config.json`, mục `create`:

```json
{
  "create": {
    "title": "Chọn loại giao dịch",
    "url": "/teamworks/executecf?processApp=GN_KHCN&serviceName=",
    "paramName": "serviceName",
    "target": "_self",
    "columns": 3,
    "types": [
      { "value": "Giaingankhoanvay", "label": "Giải ngân khoản vay",        "iconClass": "fas fa-hand-holding-usd",  "serviceName": "GNCN.Loan.Main" },
      { "value": "Giainganthauchi",  "label": "Giải ngân thấu chi",         "iconClass": "fas fa-credit-card",       "serviceName": "GNCN.Overdraft.Main" },
      { "value": "Khoitaohanmuc",    "label": "Khởi tạo hạn mức",           "iconClass": "fas fa-file-signature",    "serviceName": "GNCN.Limit.Main" },
      { "value": "NhapvaduyetFCC",   "label": "Nhập và duyệt bút toán FCC", "iconClass": "fas fa-file-invoice-dollar", "serviceName": "GNCN.ApproveFcc.Main" },
      { "value": "Khac",             "label": "Khác",                       "iconClass": "fas fa-ellipsis-h",        "serviceName": "GNCN.Other.Main" }
    ]
  }
}
```

| Thuộc tính | Ý nghĩa |
|------------|---------|
| `url` | URL trang tạo giao dịch. Có thể là đường dẫn tương đối hoặc tuyệt đối. |
| `paramName` | Tên query param nhận `serviceName` khi `url` không kết thúc bằng `=`. Mặc định `serviceName`. |
| `target` | `_self` (cùng tab) hoặc `_blank` (tab mới). |
| `columns` | Số cột của lưới thẻ (1-4). |
| `types[].value` | Mã loại giao dịch cấp 1, dùng để ghép với API danh mục (`code`). Không gửi vào URL. |
| `types[].serviceName` | Giá trị gửi vào URL khi chọn loại này (service BPM). Thiếu thì không mở link. |
| `types[].label`, `iconClass`, `description` | Hiển thị trên thẻ. |
| `types[].disabled` | Vô hiệu hoá thẻ. |
| `types[].url` | (tuỳ chọn) URL riêng cho loại này, ghi đè `create.url`. |

Quy tắc dựng URL:
- Chỉ gửi `serviceName` của loại được chọn, không gửi mã loại giao dịch cấp 1.
- `url` kết thúc bằng `=` (ví dụ `...&serviceName=`) thì nối `serviceName` vào cuối; ngược lại thêm `<paramName>=<serviceName>`, nối bằng `?` hoặc `&` tùy URL đã có query chưa.
- Ví dụ: `/teamworks/executecf?processApp=GN_KHCN&serviceName=GNCN.Loan.Main`.
- Bắt buộc `encodeURIComponent` cho giá trị. Chỉ cho phép URL cùng origin hoặc `http(s)`; chặn scheme khác (ví dụ `javascript:`).
- `target = "_blank"` thì dùng `window.open(url, "_blank", "noopener")`.

### 7.3 Nguồn danh sách loại giao dịch

- Danh sách lấy từ API danh mục `transactionTypes` (mục 5.1), dùng chung với bộ lọc **Loại giao dịch cấp 1** để không lệch nhau.
- `create.types` trong config chỉ bổ sung `iconClass`, `description`, `disabled`, `url`, `serviceName`, ghép theo `value` = `code` của API. Tên hiển thị lấy từ API.
- API chưa trả về hoặc lỗi thì popup dùng tạm `create.types` trong config. `url`, `paramName`, `target` luôn lấy từ config.

## 8. Chi tiết giao dịch

- Bấm **Mã GNTD** thì mở link chi tiết giao dịch. Cột thao tác không có icon xem chi tiết (trùng chức năng), chỉ còn **Log xử lý**.
- Link chi tiết **không hard-code** trong `index.html`. Khai báo trong `table-config.json`, mục `detail`; `index.html` nạp config qua `TableConfigAPI.load` rồi truyền vào handler `openTransactionDetail` (cùng cách trang eKYC nạp mục `detail`).
- Mapping dữ liệu hiển thị theo response API giải ngân. Component detail riêng cho giao dịch giải ngân.

### 8.1 Cấu hình

```json
{
  "detail": {
    "url": "/transactions/disb/detail?gntdCode={gntdCode}&type={transactionType1}",
    "target": "_blank"
  }
}
```

| Thuộc tính | Ý nghĩa |
|------------|---------|
| `url` | Template URL chi tiết. Placeholder `{field}` được thay bằng giá trị `field` của dòng được bấm. |
| `target` | `_self` (cùng tab) hoặc `_blank` (tab mới). Mặc định `_self`. |

### 8.2 Quy tắc dựng URL

- Mỗi `{field}` thay bằng `encodeURIComponent(row[field])`. Field không tồn tại hoặc `null` thì thay bằng chuỗi rỗng.
- Chỉ cho phép URL `http(s)` hoặc đường dẫn cùng origin; chặn scheme khác (ví dụ `javascript:`).
- `target = "_blank"` thì dùng `window.open(url, "_blank", "noopener")`, ngược lại dùng `window.location.href`.
- Thiếu `detail.url` trong config thì hiển thị Toast lỗi "Chưa cấu hình link chi tiết", không điều hướng.

### 8.3 Nạp vào index.html

```javascript
var DETAIL_CONFIG = { url: "", target: "_self" };

TableConfigAPI.load("table-config.json", function (error, config) {
    if (error) { /* Toast + return */ }
    if (config.detail) {
        if (typeof config.detail.url === "string") { DETAIL_CONFIG.url = config.detail.url; }
        if (typeof config.detail.target === "string") { DETAIL_CONFIG.target = config.detail.target; }
    }
    table = TableRenderer.fromConfig(config, {
        handlers: {
            openTransactionDetail: function (row) { openLink(DETAIL_CONFIG, row); }
        }
    });
});
```

`openLink(cfg, row)` là hàm dùng chung dựng URL theo mục 8.2.

Cả link **Khởi tạo** (mục 7.2) và link chi tiết dùng chung cơ chế: nạp từ `table-config.json` khi load `index.html`, truyền vào handler qua runtime của `fromConfig`.

## 9. Quyền truy cập

Quyền của user hiện tại do BE trả về trong **một object riêng** (object phân quyền), client không tự suy ra từ mã quyền.

```json
{
  "error": null,
  "allowBranchs": ["441", "360", "310"],
  "visibleConfig": { "create": true, "export": false }
}
```

| Thuộc tính | Ý nghĩa |
|------------|---------|
| `error` | Như response danh sách (mục 6.2): `null` là thành công. |
| `allowBranchs` | Danh sách ĐVKD user được phép. Dùng cho ô chọn ĐVKD (mục 5.2). |
| `visibleConfig.create` | `true` thì hiện nút **Khởi tạo**, ngược lại ẩn. |
| `visibleConfig.export` | `true` thì hiện nút **Tải xuống**, ngược lại ẩn. |

- Client gọi API phân quyền **một lần khi load `index.html`**, trước khi khởi tạo table, rồi truyền kết quả vào runtime:
  - `branchOptions` đọc từ `allowBranchs`.
  - Nút trong `buttons` được lọc theo `visibleConfig` (mục 9.1).
- `visibleConfig` thiếu hoặc không có key nào đó thì coi là `false` (ẩn). Gọi API phân quyền lỗi thì Toast lỗi, ẩn Khởi tạo và Tải xuống, `allowBranchs` rỗng.
- Dữ liệu danh sách, export và chi tiết do server tự giới hạn theo ĐVKD được phép (xem mục 5.2). Ẩn nút ở client chỉ để hiển thị, server vẫn phải kiểm tra quyền.
- Quyền xem danh sách (`TRANSACTION_DISBURSEMENT_QUEUE_VIEW`) vẫn kiểm tra theo cơ chế permission/route hiện có. Khai báo mã quyền trong `constants.js`.

### 9.1 Ẩn/hiện nút theo `visibleConfig`

Mỗi nút trong `buttons` có thể khai báo khoá `visibleKey` tương ứng với key trong `visibleConfig`:

```json
"buttons": [
  { "text": "Khởi tạo", "iconClass": "fas fa-plus", "handler": "openCreatePopup", "visibleKey": "create" },
  { "text": "Tải xuống", "iconClass": "fas fa-file-download", "className": "tr-btn-default", "handler": "exportExcel", "visibleKey": "export" }
]
```

`index.html` lọc `config.buttons` trước khi gọi `TableRenderer.fromConfig`: giữ lại nút không có `visibleKey` hoặc có `visibleConfig[visibleKey] === true`.

## 10. Logging

Log theo chuẩn của module transaction: Search, View detail, Export, Refresh dữ liệu, **Create** (ghi loại giao dịch được chọn và URL được mở).

## 11. Tiêu chí nghiệm thu

### Functional
- Hiển thị danh sách giao dịch giải ngân với 13 cột như mục 6.1 (gộp Loại giao dịch / PDTD và Phân luồng / Nhóm xử lý).
- Search, filter, sort, phân trang hoạt động chính xác (server-side).
- Đặt lại và Áp dụng hoạt động đúng, luôn về trang 1.
- Nút **Khởi tạo** mở popup với đúng các thẻ loại giao dịch cấp 1 theo config.
- Bấm thẻ thì mở đúng URL kèm `serviceName` của loại được chọn (đã encode), đúng `target`.
- Thẻ `disabled` không bấm được. Đóng popup bằng X hoặc Esc thì không điều hướng.
- Export, View detail hoạt động chính xác.

### UI/UX
- Giao diện giống `/transactions/block`; nội dung bộ lọc và cột lấy theo `example.png`.
- Nút Khởi tạo và Tải xuống nằm ở toolbar phía trên bảng, không nằm ở header.
- Thẻ trong popup đủ lớn, dễ bấm, dùng được bằng bàn phím.
- Responsive tương đương `/transactions/block`. Không có lỗi console.

### Technical
- Đổi URL hoặc danh sách loại giao dịch chỉ cần sửa `table-config.json`, không sửa code.
- Không làm ảnh hưởng `/transactions/block`.
- Build `js-table` thành công, unit test hiện có vẫn pass.

## 12. Tài liệu tham chiếu

- Module nguồn: `/transactions/block`
- Component: `js-table` (`fromConfig`, `renderers`, `handlers`, `optionsProviders`)
- Giao diện cũ: `example.png`
- API giải ngân: do BE hoặc tài liệu OpenAPI cung cấp. Tên field ở trên là đề xuất.
