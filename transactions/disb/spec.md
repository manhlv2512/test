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
    ├── date-util.js        # DateUtil: parse/format/tính ngày giờ, bọc moment.js
    ├── disb-sla.js         # DisbSla: tính SLA theo giờ làm việc
    ├── constants.js        # mã quyền, URL, trạng thái
    ├── disb-util.js        # DisbUtil: chuẩn hoá key Oracle, dựng/mở link, escapeHtml
    ├── disb.css            # style màn hình (ô gộp, chip, badge trạng thái, SLA, form tìm kiếm, popup Khởi tạo)
    ├── build.sh            # minify date-util.js, disb.css, disb-*.js/css -> dist/*.min.*, đóng gói disb.zip
    ├── dist/               # kết quả build (không sửa tay)
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

- Placeholder gợi ý: "GNTD, PDTD, mã/tên KH, user xử lý" (rút gọn để vừa ô 240px).
- Server tìm `keyword` (không phân biệt hoa/thường, khớp một phần) trên các cột: `gntdCode`, `pdtdCode`, `customerCode`, `customerName`, `processUser`.
- Ô Từ khoá đặt đầu tiên trong form, rộng nhất (240px), nhấn Enter để tìm.

Bố cục form: 7 điều kiện trên **1 hàng** từ màn 1280px trở lên. `width` của từng searchField là độ rộng gốc (Từ khoá 240, ĐVKD 120, Phân luồng 130, Nhóm xử lý 130, Thời điểm 220, Loại giao dịch cấp 1 210, Trạng thái 170; tổng 1.220px + 6 khoảng cách 12px vừa màn 1366px). `index.html` đổi form sang flex: màn rộng hơn thì các ô giãn đều, màn hẹp hơn thì co lại tới `min-width` (110px, Thời điểm 200px) rồi mới xuống hàng. Nút Tìm kiếm / Đặt lại ở hàng riêng.

Cấu hình:

```json
{ "name": "keyword", "label": "Từ khoá", "type": "text", "width": 240,
  "placeholder": "GNTD, PDTD, mã/tên KH, user xử lý" }
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
| Mã GNTD | `gntdCode`, `lockUser` | `gntdRenderer`: dòng 1 Mã GNTD (link tím); dòng 2 chip 🔒 user đang claim xử lý hồ sơ (ẩn nếu chưa ai claim). Bấm **bất kỳ đâu trong ô** để mở chi tiết (`className: disb-col-gntd`). |
| Loại giao dịch / PDTD | `transactionType1Name`, `pdtdCode` | `transactionRenderer`: dòng 1 loại giao dịch cấp 1, dòng 2 tag `PDTD` + mã (đậm). |
| Số tiền | `amount`, `currency` | `amountRenderer`: số tiền (chữ thường, `vi-VN`: `1.500.000.000`) + tag loại tiền; căn phải. Chỉ hiện với loại giao dịch trong `amountDisplay.types` (mục 6.1.2), loại khác để trống. |
| ĐVKD | `branchCode` | căn giữa |
| Khách hàng | `customerName`, `customerCode` | `customerRenderer`: dòng 1 tên KH (chữ thường), dòng 2 tag `MÃ KH` + mã (đậm). |
| Trạng thái | `statusName`, `status` | `statusRenderer`: badge viền + nền, màu theo mã trạng thái (mục 6.1.3); tên dài được xuống dòng. |
| User xử lý | `processUser` | user khởi tạo và chuyển phê duyệt hồ sơ |
| User phân công | `assignUser` | user được gợi ý xử lý hồ sơ |
| Phân luồng / Nhóm xử lý | `transactionFlowName`, `processGroup` | `flowGroupRenderer`: dòng 1 phân luồng, dòng 2 chip nhóm xử lý (ẩn nếu trống) |
| Thời điểm tiếp nhận | `taskStartTime` | `dateTimeRenderer`: dòng 1 `DD/MM/YYYY`, dòng 2 `HH:mm:ss`; căn phải. **Sortable**. |

Nguyên tắc gộp cột:

- Gộp các thông tin cùng nhóm nghĩa vào một ô nhiều dòng để bảng gọn, không phải cuộn ngang.
- **User lock** là user đang claim xử lý hồ sơ, gộp vào ô Mã GNTD dạng chip có icon khoá; không còn cột riêng.
- **Không gộp** User xử lý và User phân công vì khác ý nghĩa nghiệp vụ.
- Dòng phụ hoặc chip trống thì không hiển thị.
- Export (`getAllData`) vẫn xuất đủ từng field riêng.
- Mã GNTD dùng renderer riêng; click trong ô `td.disb-col-gntd` bắt bằng event delegation trên container, tra dòng theo `data-index` của link trong ô. Đang bôi đen chữ (để copy mã) thì không mở chi tiết. Hover ô thì link gạch chân, con trỏ dạng bàn tay.

Hiển thị cho màn hình 19.5" (1366×768 / 1600×900):

- Chữ chính (loại giao dịch, tên KH, phân luồng) 13px chữ thường, màu gần đen `#1f1a24`.
- Mã phụ (PDTD, Mã KH) dạng tag: nhãn 11px đậm 700 viết hoa, nền `#ebe6f0` chữ `#3d3546`; giá trị 12px đậm 600 `#1f1a24`, chữ số đều cột, không cắt chữ.
- Giờ trong cột Thời điểm: 12px `#4a4352` (tương phản ~9:1).
- Chip lock: nền `#fff3dc`, chữ `#8a5300`; chip nhóm: nền `#f1e9f7`, chữ `#5b3780` (tương phản ≥ 5:1).
- Chữ SLA 13px, màu xanh `#157a3f` / vàng `#9a6400` / đỏ `#b42318` (tương phản ≥ 5:1).
- Khi màn hình ≤ 1600px: padding ô 8px 10px, tiêu đề cột được xuống dòng.

Độ rộng cột chia 3 nhóm, để phần thừa của bảng không dồn vào các cột cuối:

| Nhóm | Cột | Cách khai báo |
|------|-----|---------------|
| Cố định | STT (50), SLA (110), Thời điểm tiếp nhận (100) | `width` (px) |
| Co theo nội dung | Mã GNTD, Số tiền, ĐVKD, User xử lý, User phân công | `className: "disb-col-fit"` (CSS `width: 1%`, trình duyệt co về độ rộng nhỏ nhất vừa nội dung) |
| Giãn | Loại giao dịch / PDTD (≥160), Khách hàng (≥140), Trạng thái (≥130), Phân luồng / Nhóm xử lý (≥110) | chỉ đặt `minWidth`; phần thừa chia cho các cột chữ này |

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

### 6.1.2 Số tiền

Cấu hình trong `table-config.json`, mục `amountDisplay`:

```json
"amountDisplay": {
  "amountField": "amount",
  "currencyField": "currency",
  "typeField": "transactionType1",
  "types": ["Giaingankhoanvay", "Giainganthauchi", "Khoitaohanmuc"],
  "decimals": { "VND": 0, "default": 2 }
}
```

| Thuộc tính | Ý nghĩa |
|------------|---------|
| `amountField`, `currencyField` | Field số tiền và loại tiền trong dòng dữ liệu. SP trả `AMOUNT`, `CURRENCY` (toCamel ra `amount`, `currency`). |
| `typeField`, `types` | Chỉ hiện số tiền khi `row[typeField]` thuộc `types` (Giải ngân khoản vay, Giải ngân thấu chi, Khởi tạo hạn mức). Bỏ `types` thì hiện cho mọi loại có số tiền. |
| `decimals` | Số chữ số thập phân theo loại tiền; loại không khai báo dùng `default`. |

- Định dạng theo `vi-VN`: VND `1.500.000.000`, USD `25.000,50`. Giá trị trống hoặc không phải số thì để trống ô.
- Số tiền dạng chuỗi từ SP (`"20000000000"`) vẫn được đổi sang số trước khi định dạng.

### 6.1.3 Màu trạng thái

Cấu hình trong `table-config.json`, mục `statusBadge`:

```json
"statusBadge": {
  "codeField": "status",
  "defaultTone": "default",
  "tones": {
    "GNCN_KHOI_TAO": "default",
    "GNCN_HUY": "default",
    "GNCN_CHO_XU_LY": "orange",
    "GNCN_CHO_BO_SUNG": "orange",
    "GNCN_DA_PHE_DUYET": "purple",
    "GNCN_LOI_HACH_TOAN_HAN_MUC": "red",
    "GNCN_LOI_HACH_TOAN_KHOAN_VAY": "red",
    "GNCN_LOI_HACH_TOAN_THAU_CHI": "red",
    "GNCN_LOI_CHUYEN_TIEN": "red",
    "GNCN_HOAN_TAT_KHOAN_VAY": "purple",
    "GNCN_HOAN_THANH": "green"
  }
}
```

| Thuộc tính | Ý nghĩa |
|------------|---------|
| `codeField` | Field chứa mã trạng thái trong dòng dữ liệu, mặc định `status`. Chữ hiển thị lấy từ `statusName`. |
| `tones` | Map mã trạng thái → màu. |
| `defaultTone` | Màu cho mã không có trong `tones`, mặc định `default`. |

Màu hợp lệ (mỗi màu là một class `.disb-status-<màu>` trong `index.html`):

| Màu | Ý nghĩa gợi ý | Viền / nền / chữ | Tương phản chữ |
|-----|---------------|------------------|----------------|
| `default` | mới tạo, trung tính | `#c3bacb` / `#ffffff` / `#3d3546` | 11.7:1 |
| `purple` | đang trong luồng xử lý | `#c9a8e6` / `#f3ecfa` / `#5b2a86` | 8.6:1 |
| `green` | hoàn thành | `#9fd5b4` / `#e8f6ee` / `#146c3a` | 5.8:1 |
| `orange` | chờ xử lý, cần chú ý | `#f2c084` / `#fff1de` / `#8a4b00` | 6.1:1 |
| `red` | lỗi | `#efb0b0` / `#fdecec` / `#a61b1b` | 6.6:1 |

- Màu sai chính tả hoặc không có trong danh sách: dùng `defaultTone` rồi `default`, và ghi cảnh báo vào khung log khi load trang.
- Thêm màu mới: thêm một class `.disb-status-<màu>` và thêm tên vào `STATUS_TONES` trong `index.html`.
- Key trong `tones` là mã trạng thái thật của BE (`GNCN_*`). Mã mới chưa khai báo sẽ dùng `defaultTone`.

Danh sách trạng thái:

| Mã | Tên | Màu |
|----|-----|-----|
| `GNCN_KHOI_TAO` | GN - Khởi tạo | default |
| `GNCN_HUY` | GN - Hủy giao dịch | default |
| `GNCN_CHO_XU_LY` | GN - Chờ xử lý | orange (tính SLA, `sla.activeStates`) |
| `GNCN_CHO_BO_SUNG` | GN - Chờ bổ sung | orange |
| `GNCN_DA_PHE_DUYET` | GN - Đã phê duyệt | purple |
| `GNCN_LOI_HACH_TOAN_HAN_MUC` | GN - Lỗi hạch toán hạn mức | red |
| `GNCN_LOI_HACH_TOAN_KHOAN_VAY` | GN - Lỗi hạch toán khoản vay | red |
| `GNCN_LOI_HACH_TOAN_THAU_CHI` | GN - Lỗi hạch toán thấu chi | red |
| `GNCN_LOI_CHUYEN_TIEN` | GN - Lỗi chuyển tiền | red |
| `GNCN_HOAN_TAT_KHOAN_VAY` | GN - Hạch toán khoản vay thành công | purple |
| `GNCN_HOAN_THANH` | GN - Hoàn thành | green |

`GNCN_HUY` và `GNCN_HOAN_THANH` là trạng thái kết thúc (khớp `C_FINISHED_STATUS` trong SP): mặc định bị ẩn khi không lọc trạng thái, và không có user claim.

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

Mapping sang `js-table`: component đọc `{ total, page, data }`, nên `searchFunction` trong `index.html` chuyển đổi response trước khi gọi callback (hàm cục bộ `mapResponse`, `lists` qua `DisbUtil.normalizeRows`):

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

Theo logic BPM (`disb-sla.js`). BE trả sẵn hai mốc của từng hồ sơ: `yellowFlagDate` (bắt đầu cảnh báo) và `redFlagDate` (hạn SLA). Client chỉ so với thời điểm hiện tại và đổi khoảng cách ra **giờ làm việc**, dựa trên `workingHours` và `holidays` trong mục `sla` của `table-config.json`.

#### Cấu hình

| Thuộc tính | Ý nghĩa |
|------------|---------|
| `statusField`, `activeStates` | Chỉ tính SLA khi `row[statusField]` thuộc `activeStates`: `["GNCN_CHO_XU_LY"]` (BPM: `DB_STATUS_CODE.CHO_XU_LY`). |
| `yellowField`, `redField` | Field mốc cảnh báo và hạn SLA, mặc định `yellowFlagDate`, `redFlagDate`. |
| `startField` | (tuỳ chọn) Thời điểm bắt đầu task, chỉ dùng cho thanh tiến độ. |
| `weekDays` | Tên 7 thứ theo thứ tự `Date.getDay()`, phần tử đầu là Chủ nhật: `["Sunday", "Monday", …, "Saturday"]`. Bắt buộc đủ 7 phần tử, sai thì cột SLA để trống và trang báo lỗi cấu hình. |
| `workingHours` | Danh sách phiên làm việc: `{ "workday": "Monday", "startTime": "08:00", "endTime": "12:00" }`. `workday` phải trùng một tên trong `weekDays`. Một thứ có thể có nhiều phiên (sáng, chiều). Thứ không có phiên nào là ngày nghỉ. |
| `holidays` | Danh sách ngày lễ: `{ "day": "2026-01-01", "description": "Tết Dương lịch" }`. Tên key trùng alias cột khi lấy từ SQL (không dùng `date`/`desc` vì là từ khoá SQL), nên gán thẳng kết quả query vào config, không cần đổi key. `day` nhận `yyyy-MM-dd`, ISO có múi giờ hoặc `DD/MM/YYYY`; `description` chỉ để ghi chú. |

Dữ liệu mẫu trong config: Thứ 2–6 làm 08:00–12:00 và 13:00–17:30 (8,5 giờ), Thứ 7 làm 08:00–12:00, Chủ nhật nghỉ; 11 ngày lễ năm 2026. Danh sách ngày lễ là mẫu, cần đối chiếu thông báo nghỉ chính thức.

#### Thuật toán

1. Không hiển thị nếu trạng thái không thuộc `activeStates`, hoặc thiếu `yellowFlagDate`/`redFlagDate`.
2. `yellow < now < red` → `warning`, còn = giờ làm việc từ `now` đến `red`.
3. `red < now` → `overdue`, quá = giờ làm việc từ `red` đến `now`.
4. Còn lại → `ok`, còn = giờ làm việc từ `now` đến `red`.
5. Giờ làm việc giữa hai mốc = tổng phần giao của khoảng đó với từng phiên trong `workingHours` của mỗi ngày, bỏ qua ngày lễ và ngày không có phiên.

Các lỗi của bản BPM được sửa khi chuyển sang `disb-sla.js`:
- So `startTimeValue` dạng HHmm (`800`) với số giây trong ngày, và cộng `workTime` (giờ) vào tổng giây: sai đơn vị. Bản mới đổi hết về giây từ `startTime`/`endTime`.
- Trừ trọn 86400 giây cho ngày nghỉ kể cả khi mốc bắt đầu giữa ngày. Bản mới tính phần giao từng phiên nên chính xác tới giây.
- `formatDate` trộn `getUTCFullYear` với `getMonth/getDate` local. Bản mới dùng ngày local.

#### Hiển thị (`slaRenderer`)

- Màu chữ và icon theo trạng thái: `ok` xanh lá `fa-clock`, `warning` vàng `fa-hourglass-half`, `overdue` đỏ `fa-exclamation-circle`.
- Thanh tiến độ 4px: % giờ làm việc đã dùng từ `startField` đến `red` (quá hạn = 100%).
- Chữ tối đa 2 đơn vị, 1n = số giờ làm việc của ngày dài nhất: "Còn 45p", "Còn 3g 20p", "Quá 2n 3g", từ 10 ngày chỉ hiện số ngày.
- Tooltip: thời điểm bắt đầu cảnh báo, hạn xử lý, % đã dùng.
- Sort SLA theo `redFlagDate` (server: `RED_FLAG_DATE`); hồ sơ không thuộc diện tính SLA luôn nằm cuối.

#### API của `disb-sla.js`

Phụ thuộc `moment.js` (`js-table/libs/moment-with-locales.min.js`) qua `DateUtil` (`date-util.js`). Thứ tự nạp: moment → `date-util.js` → `constants.js` → `disb-util.js` → `disb-sla.js`.

Build: `./build.sh` minify `date-util.js`, `disb.css` và mọi file `disb-*.js` / `disb-*.css` ra `dist/<tên>.min.*` (esbuild; JS dùng `--target=es5` nên báo lỗi nếu có cú pháp mới hơn ES5), rồi đóng gói `disb.zip`. `constants.js` không nằm trong `dist`.

Nạp trên trang thật (bản build), theo thứ tự: `table.min.css` → `disb.min.css`; moment → `date-util.min.js` → `disb-util.min.js` → `disb-sla.min.js`.

- `compute(row, cfg, now)` → `{ status, deadline, warningAt, remainingMinutes, overMinutes, progress }` hoặc `null`.
- `deadlineOf(row, cfg)`, `workSeconds(from, to, cfg)`, `addWorkMinutes(from, minutes, cfg)`, `isDayOff(date, cfg)`, `formatDuration(minutes, cfg)`.
- Dữ liệu demo trong `index.html` dùng `addWorkMinutes` để sinh `yellowFlagDate`/`redFlagDate` = `taskStartTime` + số phút cấu hình trong `DEMO_CONFIG` (mặc định 60 và 90 phút làm việc).

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
    "url": "/transactions/disb/detail?gntdCode=",
    "target": "_blank"
  }
}
```

| Thuộc tính | Ý nghĩa |
|------------|---------|
| `url` | URL chi tiết, kết thúc bằng tên param và dấu `=`. Mã GNTD của dòng được bấm nối vào cuối. |
| `target` | `_self` (cùng tab) hoặc `_blank` (tab mới). Mặc định `_self`. |

### 8.2 Quy tắc dựng URL

- `DisbUtil.buildDetailUrl(cfg, row)` trả `cfg.url + encodeURIComponent(row.gntdCode)`. Thiếu `url` hoặc `gntdCode` thì trả chuỗi rỗng.
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
            openTransactionDetail: function (row) { openDetail(row); }
        }
    });
});
```

`openDetail(row)` dựng URL bằng `DisbUtil.buildDetailUrl` (mục 8.2) rồi mở bằng `DisbUtil.openUrl`.

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
- Hiển thị danh sách giao dịch giải ngân với 12 cột như mục 6.1 (gộp Mã GNTD / User lock, Loại giao dịch / PDTD, Số tiền / loại tiền, Phân luồng / Nhóm xử lý).
- Số tiền chỉ hiển thị với Giải ngân khoản vay, Giải ngân thấu chi, Khởi tạo hạn mức.
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
