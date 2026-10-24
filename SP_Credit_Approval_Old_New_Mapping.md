# Đối chiếu hai procedure lấy phê duyệt tín dụng với DISBURSEMENT_COMMAND

## 1. Nguồn và kết quả rà soát

Nguồn kiểm tra trực tiếp:

- [export.sql — SP_GET_GNCN_CREDIT_APPROVAL_INFO_SYNC](export.sql#L7506).
- [export.sql — SP_SEARCH_GNCN_CREDIT_APPROVAL_INFO_SYNC](export.sql#L16065).
- [Thiết kế bảng mới DISBURSEMENT_COMMAND](Disbursement_Integration_Single_Table_Mapping.md), schema/comment theo Word BP-13.1 v1.4.

Tên viết tắt trong các bảng: GET = SP_GET_GNCN_CREDIT_APPROVAL_INFO_SYNC; SEARCH = SP_SEARCH_GNCN_CREDIT_APPROVAL_INFO_SYNC. Không bao gồm procedure GET có hậu tố _PAGING.

Hai procedure sử dụng **85 cột phân biệt theo cặp bảng/cột, thuộc 7 bảng**. Số này bao gồm cột đọc trong SELECT, JOIN, WHERE và ORDER BY; không tính dòng SQL bị comment, literal KHCN, tham số procedure hoặc SELECT * thành tất cả cột vật lý của bảng.

| Bảng hiện tại | SEARCH | GET | Số cột được sử dụng |
|---|---|---|---:|
| `GNCN_CREDIT_APPROVAL_INFO_SYNC` | Có | Có | 40 |
| `GNCN_CREDIT_APPROVAL_ASSET_SYNC` | Không | Có | 17 |
| `GNCN_CREDIT_APPROVAL_INCOME_SYNC` | Không | Có | 6 |
| `GNCN_CREDIT_APPROVAL_EXPENSE_SYNC` | Không | Có | 4 |
| `GNCN_CREDIT_APPROVAL_REF_CUSTOMER_SYNC` | Có | Có | 3 |
| `GNCN_CREDIT_CUSTOMER_SYNC` | Có | Có | 8 |
| `GNCN_CREDIT_CUSTOMER_DOC_SYNC` | Có | Có | 7 |
| **Tổng** | | | **85** |

Cấu trúc mới vẫn là một bảng 22 cột: 11 scalar và 11 JSON. Các đường dẫn trong bảng dưới đây tính từ gốc cột JSON. Ký hiệu addressInfo[addressType=...] là điều kiện chọn phần tử, không phải cú pháp SQL JSON path để chạy trực tiếp.

Phân loại:

- **Cột scalar**: đã có cột riêng ở DB mới; vẫn đối chiếu bảng mã/đơn vị khi cần.
- **JSON**: có property tương đồng rõ trong cột JSON mới; cần đọc array/object và chuyển datatype nếu contract kết quả cũ yêu cầu.
- **Tương đồng**: gần nghĩa nhưng không chứng minh mapping runtime; cần chốt code/text, enum hoặc tầng nghiệp vụ.
- **Quan hệ mới**: join ID cũ được biểu diễn bằng quan hệ chứa trong JSON; không có ID record tương đương.
- **Chưa khớp**: chưa có field nguồn tương đương được xác nhận; không tự sinh hoặc lấy field khác thay thế.

## 2. Đối chiếu đầy đủ theo từng bảng

### 2.1. GNCN_CREDIT_APPROVAL_INFO_SYNC

Alias: GET: GCAIS; SEARCH: a.

| Cột DB hiện tại | Procedure sử dụng | Vị trí trong bảng mới | Mức khớp | Nhận xét |
|---|---|---|---|---|
| `PDTD_CODE` | GET, SEARCH | Chưa có mapping xác nhận; có APP_NUMBER nhưng khác định danh | Chưa khớp | GET lọc = P_PDTD_CODE; SEARCH dùng LIKE. Kafka chỉ định nghĩa appNumber là mã hồ sơ LOS. |
| `SOURCE_SYNC` | GET, SEARCH | Chưa có field nguồn đồng bộ tương đương | Chưa khớp | HEADER_JSON.producer/sender là nguồn phát message, không chứng minh đồng nhất SOURCE_SYNC/PDTD/XLN. |
| `BRANCH_CODE` | GET, SEARCH | BRANCH_CODE | Cột scalar | Payload branchCode; đối chiếu hệ mã chi nhánh khi chuyển dữ liệu. |
| `PRODUCT_CODE` | GET, SEARCH | PRODUCT_SYS_NAME | Cột scalar | Payload productSysName; xác nhận bảng mã sản phẩm cũ và QLOS nếu cần giữ giá trị API cũ. |
| `PRODUCT_NAME` | GET, SEARCH | PRODUCT_TEXT | Cột scalar | Payload productText. |
| `BANK_PRODUCT_NAME` | GET, SEARCH | PAYLOAD_JSON → $.productGroupText | Tương đồng | Tên nhóm/loại sản phẩm ngân hàng; cần xác nhận không nhầm productTypeText. |
| `SUB_PRODUCT_NAME` | GET, SEARCH | Chưa thấy field tên sản phẩm con khớp trực tiếp | Chưa khớp | specificProductCodeUDF là mã cụ thể, không mặc định là tên SUB_PRODUCT_NAME. |
| `LOAN_PURPOSE` | GET | PAYLOAD_JSON → $.loanPurpose / $.loanPurposeName | Tương đồng | DB cũ có một cột; Kafka tách mã và tên. Phải xác định API cũ cần code hay text. |
| `LOAN_PURPOSE_DETAIL` | GET | PAYLOAD_JSON → $.loanPurposeDetails | JSON | Chi tiết mục đích vay. |
| `VEHICLE_CLASS` | GET | COLLATERALS_JSON → $[*].vehicleType / vehicleTypeText | Tương đồng | Cột cũ ở cấp approval, dữ liệu mới ở từng tài sản; cần chọn tài sản, code/text. |
| `VEHICLE_CONDITION` | GET | COLLATERALS_JSON → $[*].vehicleConditionText | JSON, 1–N | Tình trạng xe nằm trong từng tài sản; không lấy mặc định phần tử đầu tiên. |
| `MANUFACTURE_YEAR` | GET | COLLATERALS_JSON → $[*].carYear | JSON, 1–N | Cũ VARCHAR2, mới Number; cần chuyển kiểu và xác định tài sản. |
| `WITHDRAWAL_TERM` | GET | Chưa thấy field tương đương trong schema Phase 1.1 | Chưa khớp | Không mặc định đồng nhất loanTerm với thời hạn rút vốn. |
| `LOAN_PRODUCT_ATTACH` | GET | Chưa thấy field tương đương | Chưa khớp | Không đồng nhất sản phẩm kèm khoản vay với tài liệu documentsAttachment. |
| `LOAN_PRODUCT_ATTACH_DESC` | GET | Chưa thấy field tương đương | Chưa khớp | Chưa có mô tả sản phẩm kèm khoản vay trong mapping mới. |
| `LOAN_AMOUNT` | GET, SEARCH | OFFERED_LOAN_AMOUNT | Cột scalar | Payload offeredLoanAmount; số tiền khoản vay/phê duyệt. |
| `LOAN_PERCENTAGE` | GET | PAYLOAD_JSON → $.loanToValueRatio | JSON | Tỷ lệ cho vay; đối chiếu quy ước đơn vị phần trăm. |
| `LOAN_METHOD` | GET, SEARCH | PAYLOAD_JSON → $.loanMethod / $.loanMethodName | Tương đồng | Cũ một cột, mới tách code/text. |
| `AMOUNT_NEEDED` | GET | PAYLOAD_JSON → $.totalCapitalRequirement | JSON | Tổng nhu cầu vốn. |
| `AMOUNT_OWNED` | GET | PAYLOAD_JSON → $.ownedCapital | JSON | Vốn tự có. |
| `LOAN_TERM` | GET, SEARCH | PAYLOAD_JSON → $.loanTerm | JSON | Thống nhất đơn vị thời hạn trước khi trả kết quả cũ. |
| `GRACE_PERIOD` | GET | PAYLOAD_JSON → $.principalGracePeriod và $.interestGracePeriod | Tương đồng, 1–2 | Không gộp hai thời gian ân hạn vào một giá trị nếu chưa có quy tắc. |
| `COMMISSION_FEE` | GET | Chưa thấy field cùng nghĩa | Chưa khớp | earlyRepaymentFees là phí trả nợ trước hạn, không mặc định là commission fee. |
| `PRINCIPAL_REPAYMENT_METHOD` | GET | PAYLOAD_JSON → $.principalRepaymentMethod / principalRepaymentMethodName | Tương đồng | LOAN_REPAYMENT_INFORMATION_JSON.principalRepaymentMethod là kỳ/phương thức ở nhóm repayment riêng; cần chọn đúng tầng nghiệp vụ. |
| `INTEREST_REPAYMENT_METHOD` | GET | PAYLOAD_JSON → $.interestRepaymentMethod / interestRepaymentMethodName | Tương đồng | LOAN_REPAYMENT_INFORMATION_JSON.interestPaymentMethod thuộc nhóm repayment riêng. |
| `PAYMENT_DATE` | GET | LOAN_REPAYMENT_INFORMATION_JSON → $.scheduledPrincipalPaymentDate / scheduledInterestPaymentDate | Tương đồng, 1–2 | DB cũ một ngày, Kafka có ngày gốc và ngày lãi riêng. Đây là ngày định kỳ, không phải approvalDate. |
| `CURRENCY` | GET, SEARCH | CURRENCY | Cột scalar | Payload currency. |
| `LOAN_INTEREST_RATE` | GET | SUPPLEMENTAL_INTEREST_RATE_JSON → $[*].appInterestRates[*] | Tương đồng, 1–N | Cũ chuỗi tổng hợp, mới nhiều nguồn/kỳ lãi suất; cần quy tắc chọn draftContract/disbursementRequest và định dạng kết quả. |
| `TRUONG_NHOM` | GET | PAYLOAD_JSON → $.supervisoryEmployeeLogin | Tương đồng | GET trả TRUONG_NHOM hai lần: alias APPROVAL_LEVEL và tên TRUONG_NHOM. Mapping vai trò user cần xác nhận. |
| `APPROVAL_DATE` | GET, SEARCH | APPROVAL_DATE | Cột scalar | DB cũ DATE, DB mới TIMESTAMP WITH TIME ZONE; thống nhất timezone khi lọc theo ngày. |
| `APPROVAL_RESULT` | GET, SEARCH | PAYLOAD_JSON → $.approvalDecision / $.approvalSysName | Tương đồng | SEARCH loại giá trị Reject. Enum mới chưa có mapping sang enum cũ; không chỉ sao chép điều kiện Reject. |
| `APPROVAL_COMMENTS` | GET | PAYLOAD_JSON → $.approvalNote | JSON | Ý kiến phê duyệt. |
| `FINANC_INFO_COMMENTS` | GET | Chưa thấy field ghi chú tổng hợp cùng nghĩa | Chưa khớp | incomeList[].additionalComments là ghi chú từng nguồn thu, không mặc định là tổng hợp hồ sơ. |
| `LOAN_TYPE_TEXT` | GET | PAYLOAD_JSON → $.productTypeText | Tương đồng | Xác nhận hệ phân loại loan type/product type. |
| `CREATED_DATE` | GET, SEARCH | Chưa có timestamp DB tạo tương đương | Chưa khớp | GET trả cột; SEARCH dùng để sort. PAYLOAD_JSON.creationDate là ngày tạo hồ sơ nguồn, không mặc định là ngày đồng bộ DB. |
| `MODIFIED_DATE` | GET, SEARCH | Chưa có timestamp DB cập nhật tương đương | Chưa khớp | GET trả cột; SEARCH dùng COALESCE(MODIFIED_DATE, CREATED_DATE). Không có trường nguồn mới chắc chắn tương ứng. |
| `FINANC_INFO` | GET | FINANCIAL_INFORMATION_JSON | Tương đồng cấu trúc | DB cũ VARCHAR2 tổng hợp, v1.4 object incomeList/expenseList; không tương đương trực tiếp giá trị chuỗi. |
| `LOAN_FLOW` | GET | PAYLOAD_JSON → $.fileControlFlow | JSON | Luồng hồ sơ. |
| `CHUYEN_VIEN_KHACH_HANG` | GET | PAYLOAD_JSON → $.sellerName hoặc $.supervisoryEmployeeLogin | Tương đồng cần xác nhận | Cần xác định vai trò và cột cũ lưu login hay tên; không đồng nhất tự động. |
| `APPROVAL_LEVEL` | SEARCH | APPROVAL_LEVEL | Cột scalar | SEARCH đọc cột này. GET không đọc cột này: dòng select bị comment, thay bằng TRUONG_NHOM AS APPROVAL_LEVEL. |

### 2.2. GNCN_CREDIT_APPROVAL_ASSET_SYNC

Alias: GET: GCAAS.

| Cột DB hiện tại | Procedure sử dụng | Vị trí trong bảng mới | Mức khớp | Nhận xét |
|---|---|---|---|---|
| `ID` | GET | Không có ID tài sản DB cũ | Chưa khớp | GET trả ASSET_ID; collateralCode là mã tài sản nguồn, không phải ID record cũ. |
| `REAL_ESTATE` | GET | COLLATERALS_JSON → thông tin tài sản bất động sản | Tương đồng cấu trúc | Không có property realEstate trực tiếp; cần định dạng/mapping các field đất, giấy chứng nhận, mô tả. |
| `ASSET_FROM_LOAN_CAPITAL` | GET | Chưa thấy field tương đương | Chưa khớp | collateralDescription là mô tả chung, không chứng minh tài sản hình thành từ vốn vay. |
| `ASSET_TYPE` | GET | COLLATERALS_JSON → $[*].collateralType / collateralTypeText | Tương đồng cần xác nhận | Comment DDL cũ mô tả tài sản chính/phụ; Kafka phân loại movableProperty/... nên không map enum 1:1. |
| `COL_BRAND` | GET | COLLATERALS_JSON → $[*].carBrandText | JSON | Thương hiệu xe. |
| `COL_REGISTRATION_NUMBERCAR` | GET | COLLATERALS_JSON → $[*].registrationNumber | JSON | Số đăng ký xe. |
| `COL_VEHICLE_NUMBERPLATE` | GET | COLLATERALS_JSON → $[*].licensePlate | JSON | Biển số xe. |
| `COL_VEHICLE_COLOR` | GET | COLLATERALS_JSON → $[*].carColor | JSON | Màu xe. |
| `COL_CHASSIS_NO` | GET | COLLATERALS_JSON → $[*].chassisNumber | JSON | Số khung. |
| `COL_ENGINE_NUMBER` | GET | COLLATERALS_JSON → $[*].engineNumber | JSON | Số máy. |
| `COL_LAND_NO` | GET | COLLATERALS_JSON → $[*].lotNumber | JSON | Số thửa đất. |
| `COL_MAP_NO` | GET | COLLATERALS_JSON → $[*].mapSheetNumber | JSON | Số tờ bản đồ. |
| `COL_DOCUMENTS_PROVING_USAGE_RIGHT` | GET | COLLATERALS_JSON → $[*].legalDocuments[*] | Tương đồng cấu trúc | Cần phân loại hồ sơ chứng minh quyền sử dụng và định dạng list thành kết quả cũ. |
| `COL_DOCUMENTS_PROVING_OWNERSHIP_RIGHT` | GET | COLLATERALS_JSON → $[*].legalDocuments[*] | Tương đồng cấu trúc | Cần phân loại hồ sơ chứng minh quyền sở hữu; không gán toàn bộ list vào cả hai cột. |
| `COL_SAVING_BOOK` | GET | Chưa có nhóm tiết kiệm tương ứng trong schema Phase 1.1 | Chưa khớp | Không tự thêm dữ liệu ngoài command. |
| `COL_SAVING_BOOK_DETAIL` | GET | Chưa có chi tiết sổ tiết kiệm tương ứng | Chưa khớp | Không mặc định dùng collateralDescription. |
| `PDTD_CODE` | GET | Quan hệ chứa trong COLLATERALS_JSON của dòng command | Quan hệ mới | Cũ dùng join mã PDTD; không có mã PDTD nguồn được xác nhận trong schema mới. |

### 2.3. GNCN_CREDIT_APPROVAL_INCOME_SYNC

Alias: GET: GCAIS2.

| Cột DB hiện tại | Procedure sử dụng | Vị trí trong bảng mới | Mức khớp | Nhận xét |
|---|---|---|---|---|
| `ID` | GET | Không có ID nguồn thu DB cũ | Chưa khớp | GET trả INCOME_ID; JSON array không chứa ID record cũ. |
| `INCOME_TYPE` | GET | FINANCIAL_INFORMATION_JSON → $.incomeList[*].incomeType | JSON | Mã nguồn thu; example v1.4 thiếu field này nhưng đặc tả yêu cầu. |
| `INCOME_TYPE_BRIEF` | GET | FINANCIAL_INFORMATION_JSON → $.incomeList[*].incomeTypeText | Tương đồng | Xác nhận đây là tên/mô tả loại thu nhập. |
| `INCOME_TYPE_OTHER` | GET | Chưa thấy field riêng cùng nghĩa | Chưa khớp | Không tự dùng chung incomeTypeText cho INCOME_TYPE_OTHER và INCOME_TYPE_BRIEF. |
| `INCOME_AMOUNT` | GET | FINANCIAL_INFORMATION_JSON → $.incomeList[*].averageIncome | JSON | Cũ VARCHAR2, mới Number; cần chuyển kiểu. |
| `PDTD_CODE` | GET | Quan hệ chứa trong FINANCIAL_INFORMATION_JSON của dòng command | Quan hệ mới | Không có khóa join PDTD riêng trong object. |

### 2.4. GNCN_CREDIT_APPROVAL_EXPENSE_SYNC

Alias: GET: GCAES.

| Cột DB hiện tại | Procedure sử dụng | Vị trí trong bảng mới | Mức khớp | Nhận xét |
|---|---|---|---|---|
| `ID` | GET | Không có ID chi phí DB cũ | Chưa khớp | GET trả EXPENSE_ID. |
| `EXPENSE_TYPE` | GET | FINANCIAL_INFORMATION_JSON → $.expenseList[*].indicatorSysName / indicatorName | Tương đồng | Chốt cột cũ là code hay tên và mapping các loại chi phí. |
| `EXPENSE_VALUE` | GET | FINANCIAL_INFORMATION_JSON → $.expenseList[*].value hoặc indicatorValue | Tương đồng, chưa chốt key | V1.4 đặc tả value nhưng example indicatorValue; cũ VARCHAR2, mới Number. |
| `PDTD_CODE` | GET | Quan hệ chứa trong FINANCIAL_INFORMATION_JSON của dòng command | Quan hệ mới | Chi phí là list bên trong hồ sơ command. |

### 2.5. GNCN_CREDIT_APPROVAL_REF_CUSTOMER_SYNC

Alias: GET: GCARCS; SEARCH: r.

| Cột DB hiện tại | Procedure sử dụng | Vị trí trong bảng mới | Mức khớp | Nhận xét |
|---|---|---|---|---|
| `PDTD_CODE` | GET, SEARCH | Quan hệ participants[] thuộc dòng command | Quan hệ mới | Join cũ theo PDTD_CODE; APP_NUMBER chưa xác nhận cùng business key. |
| `CUS_ID` | GET, SEARCH | Quan hệ phần tử trong PARTICIPANTS_JSON | Quan hệ mới | Cũ nối GCCS.ID; mới không có ID customer cũ. |
| `RELATIONSHIP` | GET, SEARCH | PARTICIPANTS_JSON → $[*].relationship / relationshipText; role | Tương đồng cần map | GET trả RELATIONSHIP và ORDER BY NULLS FIRST. SEARCH dùng RELATIONSHIP IS NULL để chọn khách; không mặc định tương đương role=borrower nếu chưa chốt. |

### 2.6. GNCN_CREDIT_CUSTOMER_SYNC

Alias: GET: GCCS; SEARCH: c.

| Cột DB hiện tại | Procedure sử dụng | Vị trí trong bảng mới | Mức khớp | Nhận xét |
|---|---|---|---|---|
| `ID` | GET, SEARCH | Không có ID customer DB cũ | Chưa khớp | GET/SEARCH trả CUS_ID; CIF không phải ID record. |
| `CIF` | GET, SEARCH | PARTICIPANTS_JSON → $[*].CIF | JSON | SEARCH chọn khách qua RELATIONSHIP IS NULL ở bảng ref; mới phải xác định role phù hợp (borrower nếu chỉ tìm người vay chính). |
| `NAME` | GET, SEARCH | PARTICIPANTS_JSON → $[*].fullName | JSON | SEARCH trả CIF_NAME và tìm LOWER(NAME) LIKE; GET trả NAME. |
| `CUS_TYPE` | GET | PARTICIPANTS_JSON → $[*].type | Tương đồng cần map enum | GET đọc CUS_TYPE; SEARCH không đọc cột này mà trả literal KHCN. type individual/legal không phải cùng enum. |
| `DATE_OF_BIRTH` | GET, SEARCH | PARTICIPANTS_JSON → $[*].birthDate | JSON | Cũ DATE; mới chuỗi Date/DateTime trong JSON, cần parse đúng ngày. |
| `LIVING_ADDRESS` | GET, SEARCH | PARTICIPANTS_JSON → $[*].addressInfo[addressType=residential].fullAddress | JSON | Chọn theo addressType, không theo vị trí array. |
| `PERMANENT_ADDRESS` | GET, SEARCH | PARTICIPANTS_JSON → $[*].addressInfo[addressType=permanent].fullAddress | JSON | Chọn theo addressType. |
| `ORIGINAL_HOMETOWN` | GET, SEARCH | Chưa thấy property cùng nghĩa | Chưa khớp | Không mặc định dùng địa chỉ thường trú hoặc provinceText làm quê quán. |

### 2.7. GNCN_CREDIT_CUSTOMER_DOC_SYNC

Alias: GET: GCCDS; SEARCH: d.

| Cột DB hiện tại | Procedure sử dụng | Vị trí trong bảng mới | Mức khớp | Nhận xét |
|---|---|---|---|---|
| `ID` | GET | Không có ID giấy tờ DB cũ | Chưa khớp | GET trả DOCUMENT_ID; documentNumber không phải ID record. |
| `CUS_ID` | GET, SEARCH | Quan hệ documents[] lồng trong từng participant | Quan hệ mới | GET trả CUS_ID_OF_DOC; cũ join customer ID, mới giữ quan hệ cha–con bằng JSON. |
| `SYS_NAME` | GET, SEARCH | PARTICIPANTS_JSON → $[*].documents[*].documentType | JSON | Mã loại giấy tờ. |
| `DOC_ID` | GET, SEARCH | PARTICIPANTS_JSON → $[*].documents[*].documentNumber | JSON | Số giấy tờ, không phải ID record. SEARCH lọc trên giấy tờ IS_MAIN_DOC = 1. |
| `ISSUE_DATE` | GET, SEARCH | PARTICIPANTS_JSON → $[*].documents[*].dateIssued | JSON | Parse chuỗi ngày/DateTime nếu trả lại DATE theo API cũ. |
| `ISSUED_BY` | GET, SEARCH | PARTICIPANTS_JSON → $[*].documents[*].placeIssued | JSON | Nơi/cơ quan cấp. |
| `IS_MAIN_DOC` | GET, SEARCH | PARTICIPANTS_JSON → $[*].documents[*].isMain | JSON | Cũ 1/0, mới Boolean; cần chuyển kiểu nếu giữ contract cũ. |

## 3. Tham số tìm kiếm và field mà procedure thực sự lọc

| Procedure / tham số | Cột và điều kiện thực tế | Vị trí trong bảng mới | Kết luận |
|---|---|---|---|
| GET: P_PDTD_CODE | GCAIS.PDTD_CODE = P_PDTD_CODE | Chưa có business key PDTD được xác nhận | APP_NUMBER là mã hồ sơ LOS, chưa thể thay trực tiếp. |
| SEARCH: approvalCode | a.PDTD_CODE LIKE '%' &#124;&#124; P_CODE &#124;&#124; '%'; nhánh OUT_DATA cũng lọc PDTD_CODE của bảng ref bằng LIKE | Chưa có mapping PDTD_CODE xác nhận | Phải giải quyết business key trước khi thay truy vấn. |
| SEARCH: sourceSync | a.SOURCE_SYNC = P_SOURCE_SYNC | Chưa có SOURCE_SYNC tương đương | Không dùng HEADER_JSON.producer làm nguồn PDTD/XLN nếu chưa có mapping. |
| SEARCH: branchCode | INSTR(P_BRANCH_CODE, a.BRANCH_CODE) > 0 | BRANCH_CODE | Tham số dạng chuỗi được kiểm tra chứa mã chi nhánh; không phải IN trên array. |
| SEARCH: branchs | Parse thành P_BRANCHS, nhưng không dùng trong SELECT/WHERE | Không cần field DB mới cho tham số này | Array chi nhánh hiện không tham gia lọc trong hai cursor của SEARCH. |
| SEARCH: customerCode | c.CIF = P_CIF; c được INNER JOIN ở OUT_DATA | PARTICIPANTS_JSON → $[*].CIF | Lọc đúng participant; điều kiện người vay chính cũ dựa trên ref.RELATIONSHIP IS NULL. |
| SEARCH: customerName | LOWER(c.NAME) LIKE '%' &#124;&#124; LOWER(P_CUSTOMER_NAME) &#124;&#124; '%' | PARTICIPANTS_JSON → $[*].fullName | Giữ tìm kiếm không phân biệt hoa/thường; xác định role tương ứng. |
| SEARCH: cusIdCard | DOC_ID LIKE '%' &#124;&#124; P_ID_CARD &#124;&#124; '%', trên giấy tờ IS_MAIN_DOC = 1 | PARTICIPANTS_JSON → $[*].documents[*].documentNumber, isMain | Tìm trên giấy tờ chính của participant đã chọn, không tìm nhầm giấy tờ của người khác. |
| SEARCH: productCode | Parse vào P_PRODUCT_NAME, nhưng biến không được dùng trong truy vấn | PRODUCT_SYS_NAME | Procedure hiện chưa lọc theo sản phẩm dù đã nhận tham số productCode. |
| SEARCH: fromDate | TRUNC(TO_DATE(P_FROM_DATE, 'YYYY-MM-DD')) <= TRUNC(a.APPROVAL_DATE) | APPROVAL_DATE | Lọc bao gồm ngày bắt đầu; cần quy định timezone khi dùng timestamp mới. |
| SEARCH: toDate | TRUNC(TO_DATE(P_TO_DATE, 'YYYY-MM-DD')) >= TRUNC(a.APPROVAL_DATE) | APPROVAL_DATE | Lọc bao gồm cả ngày kết thúc bằng TRUNC; code này không dùng toDate + 1. |
| SEARCH: pageIndex | OFFSET = pageIndex * pageSize; null thì pageIndex = 0 | Tham số truy vấn, không phải cột lưu message | Chỉ ảnh hưởng phân trang. |
| SEARCH: pageSize | FETCH NEXT pageSize ROWS; null thì gán 2000 | Tham số truy vấn, không phải cột lưu message | Biến khai báo default 20 nhưng nhánh null sau parse gán 2000. |

SEARCH còn áp dụng điều kiện nghiệp vụ: a.APPROVAL_RESULT IS NULL OR a.APPROVAL_RESULT <> 'Reject'. Nếu dùng schema mới phải chốt mapping enum với approvalDecision/approvalSysName trước.

## 4. Khác biệt kết quả quan trọng

| Vấn đề | Bằng chứng trong procedure | Ảnh hưởng khi dùng bảng mới |
|---|---|---|
| APPROVAL_LEVEL không cùng nguồn | SEARCH: a.APPROVAL_LEVEL. GET: gcais.truong_nhom AS APPROVAL_LEVEL; dòng GCAIS.APPROVAL_LEVEL bị comment. | APPROVAL_LEVEL mới lấy approvalLevel chỉ tương đồng với cột SEARCH; không thay trực tiếp alias APPROVAL_LEVEL của GET. |
| Phân loại khách hàng | GET đọc GCCS.CUS_TYPE. SEARCH trả literal 'KHCN', dòng c.CUS_TYPE bị comment. | type individual/legal trong participant cần mapping; không coi literal KHCN là field nguồn đã đọc. |
| Chọn khách hàng chính | SEARCH dùng RELATIONSHIP IS NULL trên bảng ref. GET lấy mọi participant và ORDER BY RELATIONSHIP NULLS FIRST. | Cần chốt quan hệ giữa quy tắc cũ và role = borrower/coborrower/related. |
| Chọn giấy tờ | SEARCH chỉ join IS_MAIN_DOC = 1. GET lấy mọi giấy tờ rồi ORDER BY IS_MAIN_DOC DESC. | isMain trong JSON là Boolean; giữ đúng phạm vi participant và chế độ tìm kiếm/chi tiết. |
| Trạng thái phê duyệt | SEARCH loại APPROVAL_RESULT = 'Reject'; GET không có điều kiện này. | Không tự áp dụng bộ lọc Reject cho GET hoặc enum Kafka chưa map. |
| Cách sắp xếp hồ sơ | SEARCH sort COALESCE(a.MODIFIED_DATE, a.CREATED_DATE) DESC. | Bảng mới không lưu hai timestamp DB này; ngày nguồn creationDate không mặc định thay thế được. |
| COUNT có thể lệch dữ liệu phân trang | OUT_DATA INNER JOIN ref/customer và lọc DOC_ID ở WHERE. PAGINATION_INFO dùng LEFT JOIN và đưa bộ lọc customer/giấy tờ vào subquery join; không yêu cầu c/d tìm được dòng. Nhánh ref trong COUNT dùng PDTD_CODE = P_CODE thay vì LIKE. | TOTAL_RECORD không bảo đảm đếm đúng các dòng đáp ứng filter khách hàng/giấy tờ của OUT_DATA. Khi viết lại cần cùng điều kiện và cùng phạm vi đếm. |
| GET có thể trả nhiều dòng trùng thông tin cha | GET LEFT JOIN độc lập asset, income, expense, participant và document theo hồ sơ. | Nhiều phần tử tạo tổ hợp dòng, không phải một JSON object/hồ sơ. Ví dụ 2 asset × 3 income × 2 expense tạo 12 dòng trước khi nhân với customer/document. |
| ID cũ không có trong Kafka | ASSET_ID, INCOME_ID, EXPENSE_ID, CUS_ID, DOCUMENT_ID và CUS_ID_OF_DOC là ID/quan hệ bảng cũ. | JSON mới không có ID record cũ; vị trí phần tử chỉ là vị trí trong snapshot, không thay thế ID nghiệp vụ ổn định. |

## 5. Những cột DB mới chưa được hai procedure cũ khai thác trực tiếp

| Cột / nhóm ở DISBURSEMENT_COMMAND | So với hai procedure hiện tại |
|---|---|
| DQ_MESSAGE_GUID, CORRELATION_ID | Chưa thấy hai procedure đọc định danh Kafka. Không thay thế PDTD_CODE. |
| LEAD_ID | Hai procedure không SELECT/lọc leadId. |
| HEADER_JSON | Hai procedure không đọc Kafka contentType/producer/sender/spring_json_header_types. |
| EXCEPTION_CONDITIONS_JSON | Hai procedure không trả danh sách exceptionConditions. |
| ADVANCED_PAYMENT_CONDITIONS_JSON | Hai procedure không trả danh sách điều kiện trước giải ngân. |
| DOCUMENTS_ATTACHMENT_JSON | Hai procedure không join hoặc trả danh sách tài liệu đính kèm. |
| DISBURSEMENT_INFORMATION_JSON | Hai procedure không trả thông tin ngân hàng/tài khoản thụ hưởng trong nhóm này. |
| LOAN_REPAYMENT_INFORMATION_JSON | Một số cột repayment cũ có tương đồng, nhưng không trả đầy đủ repaymentAccountNumber và lịch trả nợ chi tiết của object mới. |
| SUPPLEMENTAL_INTEREST_RATE_JSON | LOAN_INTEREST_RATE chỉ là chuỗi; không trả cấu trúc chương trình, nhiều kỳ lãi suất và earlyRepaymentFees của Kafka. |
| PARTICIPANTS_JSON mở rộng v1.4 | Chưa thấy trả các property mới detailsText/details2Text, businessRegistrationNumber, legalRepresentative, outstandingBank, creditLimit. |

## 6. Kết luận cho việc chuyển logic

Bảng mới có nơi lưu đa số dữ liệu nghiệp vụ tương đồng, nhưng chưa đáp ứng toàn bộ contract trả kết quả của hai procedure cũ:

- Cần xác nhận PDTD_CODE ↔ appNumber hoặc bổ sung field nguồn được chốt; hiện chưa chứng minh cùng định danh.
- SOURCE_SYNC chưa có field nguồn tương đương trong Kafka contract hiện tại.
- Các ID bảng con và CREATED_DATE/MODIFIED_DATE của DB cũ không có trong message.
- Cần phân biệt APPROVAL_LEVEL của SEARCH với alias APPROVAL_LEVEL của GET.
- Các array/customer/document cần chọn đúng phạm vi và role; giữ nguyên CIF, fullName, documentNumber trong PARTICIPANTS_JSON như thiết kế hiện tại.
- Một appNumber có thể có nhiều command snapshot; hai procedure mới cần quy tắc chọn snapshot trước khi trả hồ sơ, không dùng DQ_MESSAGE_GUID như PDTD_CODE.

Phân tích này dựa trên code procedure trong export.sql. Mapping sang Kafka vẫn là đối chiếu ngữ nghĩa/schema, không khẳng định hệ thống cũ đã lưu các field theo mapping này. Không sửa procedure, DDL hoặc dữ liệu DB.
