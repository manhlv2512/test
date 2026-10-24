# BP-13.1 Phase 1.1 — Đối chiếu payload với cấu trúc DB hiện tại

Nguồn:

- Payload trong `BP13.1_Phase1.1_Field_Matrix.md`.
- DDL trong `export.sql`.

Giới hạn phân tích: `export.sql` chỉ có cấu trúc bảng và comment, không có `INSERT`, procedure, trigger, package hoặc foreign key. Vì vậy bảng dưới đây là ánh xạ theo tên cột và ngữ nghĩa, không phải bằng chứng về code runtime đang thực thi.

## Kết luận kiến trúc

Payload có khả năng được xử lý theo ba tầng:

```text
Kafka payload
   │
   ├─ Raw/audit JSON
   │    ├─ LOG_LOS_TO_BPM
   │    └─ CREDIT_APPROVAL_INFO_RAW
   │
   ├─ Dữ liệu phê duyệt đã chuẩn hóa — khóa liên kết PDTD_CODE
   │    ├─ GNCN_CREDIT_APPROVAL_INFO_SYNC
   │    ├─ GNCN_CREDIT_CUSTOMER_SYNC
   │    ├─ GNCN_CREDIT_CUSTOMER_DOC_SYNC
   │    ├─ GNCN_CREDIT_APPROVAL_REF_CUSTOMER_SYNC
   │    ├─ GNCN_CREDIT_APPROVAL_INCOME_SYNC
   │    ├─ GNCN_CREDIT_APPROVAL_EXPENSE_SYNC
   │    └─ GNCN_CREDIT_APPROVAL_ASSET_SYNC
   │
   └─ Hồ sơ/giao dịch giải ngân — khóa liên kết GNTD_CODE
        ├─ GNCN_TRANSACTION
        ├─ GNCN_TRANSACTION_PURPOSE
        ├─ GNCN_TRANSACTION_PAYMENT
        ├─ GNCN_TRANSACTION_PAYMENT_DEAIL
        ├─ GNCN_TRANSACTION_ATTACHMENT
        └─ GNCN_TRANSACTION_DOC
```

Một payload chứa các array nên một lần consume có thể sinh nhiều bản ghi:

- 1 bản raw/log.
- 1 hồ sơ phê duyệt.
- N participant/customer.
- N giấy tờ định danh.
- N nguồn thu.
- N tài sản bảo đảm.
- N tài liệu đính kèm.
- 1 giao dịch giải ngân, kèm N mục đích/N khoản thanh toán tùy logic BPM.

## 1. Tầng raw/log

| Nhóm payload | Bảng/cột tương đồng | Mức khớp | Nhận xét |
|---|---|---|---|
| Toàn bộ payload | `LOG_LOS_TO_BPM.APPROVAL_DATA` | Cao | CLOB phù hợp lưu request gốc hoặc phần approval tổng hợp. |
| Application/approval | `LOG_LOS_TO_BPM.CREDIT_INFO` | Cao | CLOB thông tin tín dụng. |
| Customer chính | `LOG_LOS_TO_BPM.CUSTOMER_INFO` | Cao | CLOB thông tin khách hàng. |
| `participants[]` | `LOG_LOS_TO_BPM.BORROWER_INFO` | Cao | CLOB/JSON array người vay và đồng vay. |
| `collaterals[]` | `LOG_LOS_TO_BPM.COLLATERAL_INFO` | Cao | CLOB/JSON array tài sản bảo đảm. |
| `financialInformation.*.incomeList[]` | `LOG_LOS_TO_BPM.INCOME_INFO` | Cao | CLOB/JSON thu nhập. |
| Expense, chưa có trong payload chính | `LOG_LOS_TO_BPM.EXPENSE_INFO` | Cao về cấu trúc DB | DB đã dành chỗ cho expense nhưng contract Phase 1.1 hiện chưa có `expenseList[]`. |
| `appNumber` | `LOG_LOS_TO_BPM.LOS_ID` | Cao | Cùng ngữ nghĩa mã hồ sơ LOS. |
| `appNumber` | `CREDIT_APPROVAL_INFO_RAW.LOS_ID` | Cao | Mã hồ sơ LOS. |
| `leadId` | `CREDIT_APPROVAL_INFO_RAW.LEAD_ID` | Cao | Khớp trực tiếp. |
| Approval object | `CREDIT_APPROVAL_INFO_RAW.APPROVAL_INFO` | Cao | CLOB JSON thông tin phê duyệt. |
| Customer/participant | `CREDIT_APPROVAL_INFO_RAW.CUSTOMER`, `BORROWERS` | Cao | CLOB JSON. |
| Collateral/income | `CREDIT_APPROVAL_INFO_RAW.COLLATERALS`, `INCOMES` | Cao | CLOB JSON array. |
| Expense | `CREDIT_APPROVAL_INFO_RAW.ENPENSES` | Cao về cấu trúc DB | Tên cột có typo `ENPENSES`; payload Phase 1.1 chưa chốt expense. |
| `status` | `CREDIT_APPROVAL_INFO_RAW.STATUS` | Trung bình | Có thể là trạng thái parse/sync thay vì `application.status`; cần kiểm tra code. |

## 2. Application và approval

| Payload field | Bảng/cột tương đồng | Mức khớp | Quy tắc/điểm cần xác nhận |
|---|---|---|---|
| `appNumber` | `*.PDTD_CODE` | Trung bình | `PDTD_CODE` là mã phê duyệt tín dụng; chưa có bằng chứng nó chính là `appNumber`. Đây có thể là khóa nghiệp vụ do BPM tạo/mapping. |
| `branchCode` | `GNCN_CREDIT_APPROVAL_INFO_SYNC.BRANCH_CODE` | Cao | Khớp trực tiếp. |
| `branchCode` | `GNCN_TRANSACTION.BRANCH_CODE` | Cao | Được copy sang hồ sơ giao dịch giải ngân. |
| `productSysName` | `GNCN_CREDIT_APPROVAL_INFO_SYNC.PRODUCT_CODE` | Cao | Mã sản phẩm. |
| `productText` | `GNCN_CREDIT_APPROVAL_INFO_SYNC.PRODUCT_NAME` | Cao | Tên sản phẩm. |
| `productGroupText` | `BANK_PRODUCT_NAME` hoặc `LOAN_TYPE_TEXT` | Trung bình | Cần xác nhận bảng mapping sản phẩm. |
| `specificProductCodeUDF` | `SUB_PRODUCT_NAME`, `LOAN_PRODUCT` hoặc `GNCN_TRANSACTION.PRODUCT_CODE` | Thấp–trung bình | Tên cột DB chưa đồng nhất mã/tên. |
| `loanPurpose`/`loanPurposeName` | `GNCN_CREDIT_APPROVAL_INFO_SYNC.LOAN_PURPOSE` | Cao | DB chỉ có một cột nên phải chốt lưu code hay text. |
| `loanPurposeDetails` | `LOAN_PURPOSE_DETAIL` | Cao | Khớp trực tiếp. |
| `totalCapitalRequirement` | `AMOUNT_NEEDED` | Cao | Tổng nhu cầu vốn. |
| `ownedCapital` | `AMOUNT_OWNED` | Cao | Vốn tự có. |
| `offeredLoanAmount` | `LOAN_AMOUNT` | Cao | Số tiền được phê duyệt. |
| `offeredLoanAmount` | `GNCN_TRANSACTION.APPROVAL_TOTAL_AMOUNT` | Cao | Snapshot số tiền phê duyệt trong giao dịch. |
| `currency` | `GNCN_CREDIT_APPROVAL_INFO_SYNC.CURRENCY` | Cao | Khớp trực tiếp. |
| `currency` | `GNCN_TRANSACTION.CURRENCY` | Cao | Đồng tiền giao dịch. |
| `loanToValueRatio` | `LOAN_PERCENTAGE` | Cao | Tỷ lệ cho vay. |
| `loanTerm` | `LOAN_TERM` | Cao | Có ở cả approval sync và transaction. |
| `principalGracePeriod`, `interestGracePeriod` | `GRACE_PERIOD` | Trung bình | Hai field payload nhưng DB chỉ có một cột; có nguy cơ mất nghĩa hoặc phải ghép JSON/text. |
| `loanMethod`/`loanMethodName` | `LOAN_METHOD` | Cao | DB chỉ có một cột, cần chốt code hay text. |
| `principalRepaymentMethod*` | `PRINCIPAL_REPAYMENT_METHOD` | Cao | Khớp trực tiếp về nghiệp vụ. |
| `interestRepaymentMethod*` | `INTEREST_REPAYMENT_METHOD` | Cao | Khớp trực tiếp về nghiệp vụ. |
| `approvalLevel` | `APPROVAL_LEVEL` | Cao | Khớp trực tiếp. |
| `approvalDate` | `APPROVAL_DATE` | Cao | Khớp trực tiếp. |
| `approvalDecision*`/`approvalSysName`/`approvalName` | `APPROVAL_RESULT` | Cao về nghiệp vụ | Payload đang có hai bộ tên; DB chỉ có một cột kết quả. |
| `approvalNote` | `APPROVAL_COMMENTS` | Cao | Ghi chú phê duyệt. |
| `approvalBy` | `GNCN_TRANSACTION.APPROVAL_BY` | Trung bình–cao | Có thể copy sang transaction; approval sync không có cột người duyệt. |
| `fileControlFlow` | `LOAN_FLOW` | Cao | Luồng hồ sơ. |
| `supervisoryEmployeeLogin` | `TRUONG_NHOM` hoặc `CHUYEN_VIEN_KHACH_HANG` | Trung bình | Cần xác nhận vai trò thực tế trong mapping. |
| `sellerCode`, `sellerName` | `CVKH`, `CHUYEN_VIEN_KHACH_HANG` | Trung bình | Có tương đồng nghiệp vụ nhưng chưa rõ cột lưu code hay tên. |
| `state*`, `status*` | `GNCN_TRANSACTION.STATUS`, `PROCESS_FLOW` | Thấp–trung bình | Trạng thái QLOS và trạng thái BPM không cùng enum; không nên map 1:1 nếu chưa có bảng chuyển đổi. |

Ngoài cụm `GNCN_*`, bảng cũ/tổng quát `CREDIT_APPROVAL_INFO_SYNC` cũng có các cột tương đồng như `LEAD_ID`, `BRANCH_CODE`, `CUSTOMER_CODE`, `PRODUCT_CODE`, `LOAN_AMOUNT`, `LOAN_TERM`, `APPROVAL_LEVEL`, `APPROVAL_DATE`, `APPROVAL_RESULT`. Chỉ từ DDL chưa xác định được hệ thống đang dùng bảng này hay `GNCN_CREDIT_APPROVAL_INFO_SYNC` làm nguồn chính.

## 3. Participant/customer và giấy tờ

| Payload field | Bảng/cột tương đồng | Mức khớp | Nhận xét |
|---|---|---|---|
| `participants[].CIF` | `GNCN_CREDIT_CUSTOMER_SYNC.CIF` | Cao | Khóa khách hàng nghiệp vụ. |
| `participants[].fullName` | `GNCN_CREDIT_CUSTOMER_SYNC.NAME` | Cao | Tên khách hàng. |
| `participants[].birthDate` | `DATE_OF_BIRTH` | Cao | Khớp trực tiếp. |
| `participants[].addressInfo[addressType=residential].fullAddress` | `LIVING_ADDRESS` | Cao | Cần chọn theo `addressType`. |
| `participants[].addressInfo[addressType=permanent].fullAddress` | `PERMANENT_ADDRESS` | Cao | Cần chọn theo `addressType`. |
| `participants[].role` | `GNCN_CREDIT_CUSTOMER_SYNC.CUS_TYPE` | Thấp | `role` là borrower/coborrower; `CUS_TYPE` có thể là cá nhân/doanh nghiệp, không nên map trực tiếp. |
| `participants[].relationship*` | `GNCN_CREDIT_APPROVAL_REF_CUSTOMER_SYNC.RELATIONSHIP` | Cao | Bảng liên kết customer với hồ sơ qua `CUS_ID` và `PDTD_CODE`. |
| Participant ↔ application | `REF_CUSTOMER_SYNC.CUS_ID`, `PDTD_CODE` | Cao về mô hình | DDL không có FK nên cần kiểm tra `CUS_ID` trỏ tới `CUSTOMER_SYNC.ID` hay CIF. |
| `participants[].documents[].documentType` | `GNCN_CREDIT_CUSTOMER_DOC_SYNC.SYS_NAME` | Cao | Mã loại giấy tờ. |
| `participants[].documents[].documentNumber` | `DOC_ID` | Cao | Số giấy tờ; tên `DOC_ID` dễ bị hiểu nhầm là ID record. |
| `participants[].documents[].dateIssued` | `ISSUE_DATE` | Cao | Ngày cấp. |
| `participants[].documents[].placeIssued` | `ISSUED_BY` | Cao | Nơi/cơ quan cấp. |
| `participants[].documents[].isMain` | `IS_MAIN_DOC` | Cao | Boolean phải đổi sang NUMBER 0/1. |
| `gender`, `mobileNumber`, `email` | Không thấy cột trực tiếp trong `GNCN_CREDIT_CUSTOMER_SYNC` | Không khớp | Có thể chỉ giữ ở raw JSON hoặc bảng khác ngoài export. |
| Province/district/addressDetail | Không có cột riêng | Không khớp trực tiếp | DB chỉ có địa chỉ đã ghép `LIVING_ADDRESS`/`PERMANENT_ADDRESS`. |

## 4. Financial information

| Payload field | Bảng/cột tương đồng | Mức khớp | Nhận xét |
|---|---|---|---|
| `incomeList[].incomeType` | `GNCN_CREDIT_APPROVAL_INCOME_SYNC.INCOME_TYPE` | Cao | Mã loại thu nhập. |
| `incomeList[].incomeTypeText` | `INCOME_TYPE_BRIEF` hoặc `INCOME_TYPE_OTHER` | Trung bình | Cần chốt ý nghĩa hai cột DB. |
| `incomeList[].averageIncome` | `INCOME_AMOUNT` | Cao | DB đang dùng VARCHAR2 thay vì NUMBER. |
| `incomeList[].additionalComments` | `DETAILS_OF_THE_INCOME` | Trung bình | Có thể dùng cho ghi chú/chi tiết nguồn thu. |
| `incomeList[].ownerIncome` | Không thấy cột trực tiếp | Không khớp | Có thể bị gộp vào `DETAILS_OF_THE_INCOME` hoặc chỉ giữ raw. |
| `averageTotalMonthlyIncome` | Không thấy cột trực tiếp | Không khớp | Có thể tính tổng khi đọc hoặc lưu trong `FINANC_INFO`. |
| `incomeList[].details[]` | `DETAILS_OF_THE_INCOME` | Thấp–trung bình | Array chi tiết không có bảng con; có nguy cơ bị serialize/gộp text. |
| `expenseList[]` đề xuất trong comment | `GNCN_CREDIT_APPROVAL_EXPENSE_SYNC` | Cao về mô hình | DB có `EXPENSE_TYPE`, `EXPENSE_VALUE`, `DETAIL_OF_THE_EXPENSE`, `GENERAL_COMMENT`, nhưng contract Phase 1.1 chưa chốt expense. |

Mỗi phần tử `incomeList[]` hợp lý nhất sẽ tạo một dòng `GNCN_CREDIT_APPROVAL_INCOME_SYNC`, cùng `PDTD_CODE`.

## 5. Collateral

| Payload field | Bảng/cột tương đồng | Mức khớp |
|---|---|---|
| `collaterals[].collateralType*` | `GNCN_CREDIT_APPROVAL_ASSET_SYNC.ASSET_TYPE`; `GNCN_CREDIT_APPROVAL_INFO_SYNC.TSBD_TYPE` | Cao về nghiệp vụ |
| `carBrandText` | `COL_BRAND` | Cao |
| `registrationNumber` | `COL_REGISTRATION_NUMBERCAR` | Cao |
| `licensePlate` | `COL_VEHICLE_NUMBERPLATE` | Cao |
| `carColor` | `COL_VEHICLE_COLOR` | Cao |
| `chassisNumber` | `COL_CHASSIS_NO` | Cao |
| `engineNumber` | `COL_ENGINE_NUMBER` | Cao |
| `lotNumber` | `COL_LAND_NO` | Cao |
| `mapSheetNumber` | `COL_MAP_NO` | Cao |
| `vehicleConditionText` | `GNCN_CREDIT_APPROVAL_INFO_SYNC.VEHICLE_CONDITION` | Cao |
| `carYear` | `MANUFACTURE_YEAR` | Cao |
| `vehicleType*` | `VEHICLE_CLASS` | Trung bình |
| Legal documents | `COL_DOCUMENTS_PROVING_USAGE_RIGHT`, `COL_DOCUMENTS_PROVING_OWNERSHIP_RIGHT` | Trung bình | Payload là list generic, DB tách theo loại quyền; cần rule phân loại. |
| `collateralCode`, `estimatedValue`, owner list, `carModelText`, `carCountryText`, `certNumber` | Không thấy cột chuẩn hóa tương ứng rõ ràng | Không khớp | Có thể chỉ tồn tại trong raw `COLLATERALS`/`COLLATERAL_INFO`. |

Mỗi phần tử `collaterals[]` hợp lý nhất sẽ tạo một dòng `GNCN_CREDIT_APPROVAL_ASSET_SYNC` theo `PDTD_CODE`, nhưng owner và legal document dạng list không có bảng con tương ứng trong DDL.

## 6. Lãi suất và trả nợ

| Payload field/group | Bảng/cột tương đồng | Mức khớp | Nhận xét |
|---|---|---|---|
| `appInterestRates[]` | `GNCN_CREDIT_APPROVAL_INFO_SYNC.LOAN_INTEREST_RATE` | Thấp–trung bình | Payload là array nhiều kỳ; DB chỉ có VARCHAR2, có thể lưu text tổng hợp. |
| `principalRepaymentMethod` | `PRINCIPAL_REPAYMENT_METHOD` | Cao | Khớp trực tiếp. |
| `interestPaymentMethod` | `INTEREST_REPAYMENT_METHOD` | Cao | Khớp trực tiếp. |
| Scheduled payment dates | `PAYMENT_DATE` | Trung bình | Payload có ngày gốc và ngày lãi riêng; DB chỉ có một cột. |
| `detailedRepaymentScheduleData` và toàn bộ chi tiết rate/fee | `GNCN_TRANSACTION_PURPOSE.LOAN_DATA` | Trung bình | CLOB phù hợp lưu JSON chi tiết nhưng DDL không chứng minh runtime đang dùng vậy. |
| Promotion, margin, rate code, adjustment period, early repayment fee array | Không có bảng transaction chuẩn hóa rõ ràng | Không khớp | Các bảng `HKCN_RATE_*_CONFIG` là cấu hình, không phải nơi hiển nhiên để lưu snapshot payload. |
| `loanRepaymentInformation.repaymentAccountNumber` | Không thấy cột đúng nghĩa | Không khớp | Không nên tự map sang `TRANSFER_ACCOUNT_NUM`; comment DB mô tả đó là tài khoản nguồn chuyển tiền/MBNT, không phải tài khoản trả nợ. |

## 7. Giải ngân, mục đích và thanh toán

| Payload field | Bảng/cột tương đồng | Mức khớp | Nhận xét |
|---|---|---|---|
| `offeredLoanAmount` | `GNCN_TRANSACTION_PURPOSE.TOTAL_AMOUNT` | Trung bình–cao | Số tiền mục đích giải ngân; có thể khác số tiền phê duyệt tổng. |
| `currency` | `GNCN_TRANSACTION_PURPOSE.CURRENCY` | Cao | Khớp trực tiếp. |
| `loanTerm` | `GNCN_TRANSACTION_PURPOSE.DEADLINE` | Cao | Thời hạn; cần thống nhất đơn vị với `DURATION_UNIT`. |
| `loanPurposeDetails` | `GNCN_TRANSACTION_PURPOSE.REASON` | Cao | Mục đích/lý do giải ngân. |
| Loan/rate/repayment detail | `GNCN_TRANSACTION_PURPOSE.LOAN_DATA` | Trung bình | CLOB JSON. |
| `disbursementInformation.beneficiary` | `GNCN_TRANSACTION_PAYMENT_DEAIL.BANK_CODE` | Cao nếu beneficiary là Bank ID | Comment review BP-13.1 đề xuất Bank ID, ví dụ `970423`. |
| `disbursementInformation.beneficiaryText` | `GNCN_TRANSACTION_PAYMENT_DEAIL.BANK_NAME` | Cao | Tên ngân hàng thụ hưởng. |
| `payeeAccountNumber` | `GNCN_TRANSACTION_PAYMENT_DEAIL.ACCOUNT_NUM` | Cao | Số tài khoản thụ hưởng. |
| `payeeName` | `GNCN_TRANSACTION_PAYMENT_DEAIL.ACCOUNT_NAME` | Cao | Tên người thụ hưởng. |
| `currency` | `GNCN_TRANSACTION_PAYMENT.CURRENCY` | Cao | Đồng tiền thanh toán. |
| Tổng tiền chuyển | `GNCN_TRANSACTION_PAYMENT.TRANSFER_TOTAL_AMOUNT`; detail `AMOUNT` | Trung bình | Phase 1.1 chưa có amount cụ thể trong disbursement object; amount riêng được đánh dấu Phase 1.2. |

`GNCN_TRANSACTION_PAYMENT.TRANSFER_ACCOUNT_*` và `RECEIVE_ACCOUNT_*` phục vụ MBNT/chuyển tiền nội bộ theo comment DDL; không nên mặc định coi chúng là tài khoản thụ hưởng hoặc tài khoản trả nợ nếu chưa kiểm tra code.

## 8. Documents Attachment

| Payload field | Bảng/cột tương đồng | Mức khớp | Nhận xét |
|---|---|---|---|
| `documentsAttachment[].docId` | `GNCN_TRANSACTION_ATTACHMENT.DOC_ID` | Cao | ID tài liệu/ECM. |
| `typeSysName` | `DOCUMENT_GROUP` hoặc `DOCUMENT_CATEGORY` trong `GNCN_TRANSACTION_DOC` | Trung bình | Cần bảng mapping loại tài liệu. |
| `typeName` | `GNCN_TRANSACTION_ATTACHMENT.DOC_NAME` | Trung bình–cao | Tên loại/tên tài liệu. |
| `attachName` | `GNCN_TRANSACTION_ATTACHMENT.FILE_NAME` | Cao | Tên file. |
| `attachCreator` | `CREATED_BY` | Cao | User upload. |
| `attachCreateDate` | `CREATED_DATE` | Cao | Thời điểm upload. |
| `docId` | `GNCN_CA_DISBURSEMENT_ATTACHMENT.ECM_FILE_ID` | Trung bình | Bảng này phục vụ hồ sơ sau giải ngân, không chắc dùng cho request ban đầu. |
| `attachName` | `GNCN_CA_DISBURSEMENT_ATTACHMENT.FILE_NAME` | Trung bình | Tương đồng cấu trúc, nhưng khác use case. |

## 9. Kafka header và reply

| Payload/header | Cột DB tương đồng | Kết luận |
|---|---|---|
| `dqMessageGuid` | Không tìm thấy trong cụm bảng GNCN | Chưa có nơi lưu tường minh. |
| `correlationId` | Không tìm thấy trong cụm bảng GNCN | Rủi ro đối soát/idempotency nếu chỉ nằm trong log ứng dụng hoặc CLOB. |
| `producer`, `sender`, `contentType` | Không tìm thấy cột trực tiếp | Có thể chỉ phục vụ transport và không persist. |
| Reply `status` | `GNCN_TRANSACTION.STATUS`, `TRANSACTION_PAYMENT_STATUS`, `RESULT_INTERFACE` | Chỉ tương đồng tên | Các enum có thể khác nhau; cần mapping rõ. |
| Reply `statusCode` | Các cột `*_CODE`/`RESULT_INTERFACE` | Thấp | Không có cột kết quả BPM reply chuyên biệt. |
| Reply `message` | `GNCN_TRANSACTION.MESSAGE` | Cao về cấu trúc | Có cột message nhưng cần kiểm tra mục đích runtime. |
| Reply `disbursementStatus` | `GNCN_TRANSACTION.STATUS` | Trung bình | Cần bảng mapping enum BPM → enum DB/QLOS. |

Không có cột `CORRELATION_ID` trong các bảng GNCN liên quan. `SIGN_INTEGRATION_LOG.CORRELATION_ID` thuộc module ký số, không nên tái sử dụng cho giải ngân.

## 10. Khóa liên kết suy ra từ DDL

| Khóa | Vai trò suy ra | Bảng sử dụng |
|---|---|---|
| `LOS_ID` | Mã hồ sơ nguồn LOS | `LOG_LOS_TO_BPM`, `CREDIT_APPROVAL_INFO_RAW` |
| `PDTD_CODE` | Mã hồ sơ/quyết định phê duyệt tín dụng | Các bảng `GNCN_CREDIT_APPROVAL_*_SYNC`, `GNCN_TRANSACTION`, tài liệu/attachment |
| `CUS_ID` | Liên kết participant với customer | `GNCN_CREDIT_APPROVAL_REF_CUSTOMER_SYNC`, `GNCN_CREDIT_CUSTOMER_DOC_SYNC` |
| `GNTD_CODE` | Mã giao dịch giải ngân | `GNCN_TRANSACTION` và hầu hết bảng con transaction/payment/document |
| `TRANS_PURPOSE_ID` | Liên kết payment với mục đích giải ngân | `GNCN_TRANSACTION_PAYMENT`, `GNCN_TRANSACTION_PAYMENT_DEAIL` |
| `TRANS_PAYMENT_ID` | Liên kết payment detail với payment | `GNCN_TRANSACTION_PAYMENT_DEAIL` |

DDL export không khai báo PK/FK/unique constraint, nên các quan hệ trên chỉ được suy ra từ tên cột và comment.

## 11. Các khoảng trống đáng chú ý

1. Không có `correlationId`/`dqMessageGuid` chuyên biệt để bảo đảm idempotency và tra cứu command–reply.
2. `appNumber` không có ánh xạ chắc chắn sang `PDTD_CODE`; cần kiểm tra code consumer hoặc dữ liệu mẫu.
3. Payload có nhiều array/nested object nhưng một số bảng đích chỉ có VARCHAR2 đơn, dễ bị flatten hoặc mất dữ liệu.
4. Participant còn thiếu nơi lưu gender/mobile/email và thành phần địa chỉ riêng.
5. Collateral thiếu owner list, estimated value, collateral code và legal document list tổng quát.
6. Interest rate/early repayment fee là array nhưng không có bảng snapshot chuẩn hóa tương ứng.
7. Hai grace period và nhiều payment date của payload bị co về một cột DB.
8. Expense đã có bảng DB/raw column nhưng chưa có contract Phase 1.1 đã chốt.
9. Không thể xác nhận transaction boundary: nếu insert nhiều bảng thất bại giữa chừng, DDL không cho biết rollback/retry/idempotency được xử lý thế nào.

## 12. Điểm cần kiểm tra trong source/runtime

Để biến mapping suy luận thành mapping chính xác, cần tìm trong source consumer các thao tác sau:

- Insert vào `LOG_LOS_TO_BPM` hoặc `CREDIT_APPROVAL_INFO_RAW`.
- Mapping `LOS_ID/appNumber` sang `PDTD_CODE`.
- Upsert customer theo CIF hay theo ID nội bộ.
- Vòng lặp insert `participants[]`, `documents[]`, `incomeList[]`, `collaterals[]`.
- Cách serialize `details[]`, interest rate và repayment fee array.
- Cách sinh `GNTD_CODE` và liên kết với `PDTD_CODE`.
- Nơi lưu `correlationId` và cơ chế chống xử lý trùng Kafka message.
- Transaction DB bao phủ toàn bộ cụm insert hay từng bảng commit độc lập.
