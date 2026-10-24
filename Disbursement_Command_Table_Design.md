# Thiết kế một bảng DISBURSEMENT_COMMAND

## 1. Phạm vi và cấu trúc

Bảng chỉ lưu header và payload Phase 1.1 từ topic **qlapin-bpm-disbursement-command**. Một dòng tương ứng một command; DQ_MESSAGE_GUID lấy từ header là khóa chính.

Schema và comment tại mục 1–6 được cập nhật theo **BP-13.1 BPM Disbursement v1.4 (1).docx**. Các nhóm được tham chiếu tiếp tục đối chiếu với BP-6.1. Mục 7 và file INSERT liên kết là bản mẫu lịch sử lấy từ v1.1; không dùng làm mẫu schema tài chính v1.4.

Tổng cộng **22 cột vật lý: 11 cột scalar và 11 cột JSON**.

- 11 cột scalar: 2 định danh header và 9 field scalar cấp đầu của payload.
- HEADER_JSON: 4 field header còn lại.
- PAYLOAD_JSON: 51 field scalar cấp đầu còn lại của payload.
- 9 cột JSON riêng: mỗi cột chứa một nhóm object/array cấp đầu của payload.

Không lưu reply, ID tự sinh, trạng thái xử lý, retry, lỗi nội bộ, timestamp hệ thống hay Kafka metadata như topic/partition/offset.

Các nhóm con tiếp tục nằm trong nhóm cha để giữ đúng quan hệ: documents/addressInfo nằm trong PARTICIPANTS_JSON; owners/legalDocuments nằm trong COLLATERALS_JSON; appInterestRates/earlyRepaymentFees nằm trong SUPPLEMENTAL_INTEREST_RATE_JSON.

## 2. Danh sách đầy đủ 22 cột vật lý

| STT | Cột DB | Kiểu đề xuất | Bắt buộc | Ý nghĩa | Nguồn Kafka |
|---|---|---|---|---|---|
| 1 | `DQ_MESSAGE_GUID` | VARCHAR2(36 CHAR) | Có, PK | Định danh duy nhất của command. | Header `dqMessageGuid` |
| 2 | `CORRELATION_ID` | VARCHAR2(36 CHAR) | Có | Mã tương quan để tra cứu command. | Header `correlationId` |
| 3 | `APP_NUMBER` | VARCHAR2(50 CHAR) | Có | Mã hồ sơ vay QLOS. | Payload `appNumber` |
| 4 | `LEAD_ID` | NUMBER(19) | Có | Mã lead, theo kiểu Long của contract. | Payload `leadId` |
| 5 | `BRANCH_CODE` | VARCHAR2(50 CHAR) | Có | Mã chi nhánh. | Payload `branchCode` |
| 6 | `PRODUCT_SYS_NAME` | VARCHAR2(100 CHAR) | Có | Mã sản phẩm. | Payload `productSysName` |
| 7 | `OFFERED_LOAN_AMOUNT` | NUMBER(24,4) | Có | Số tiền vay đề xuất/phê duyệt. | Payload `offeredLoanAmount` |
| 8 | `CURRENCY` | VARCHAR2(10 CHAR) | Không | Đồng tiền khoản vay. | Payload `currency` |
| 9 | `PRODUCT_TEXT` | VARCHAR2(255 CHAR) | Có | Tên sản phẩm. | Payload `productText` |
| 10 | `APPROVAL_DATE` | TIMESTAMP(6) WITH TIME ZONE | Chưa quy định | Thời điểm phê duyệt, dùng lọc khoảng ngày. | Payload `approvalDate` |
| 11 | `APPROVAL_LEVEL` | VARCHAR2(100 CHAR) | Không | Cấp phê duyệt. | Payload `approvalLevel` |
| 12 | `HEADER_JSON` | CLOB JSON object | Có | Các header còn lại; cấu hình tại mục 4.1. | Header sau khi tách `dqMessageGuid`, `correlationId` |
| 13 | `PAYLOAD_JSON` | CLOB JSON object | Có | Các field scalar còn lại; cấu hình tại mục 4.2. | Payload sau khi tách 9 field cấp đầu và 9 nhóm JSON |
| 14 | `EXCEPTION_CONDITIONS_JSON` | CLOB JSON array | Không | Điều kiện ngoại lệ. | Payload `exceptionConditions` |
| 15 | `PARTICIPANTS_JSON` | CLOB JSON array | Cần chốt cấp nhóm | Toàn bộ thông tin người vay/đồng vay/người liên quan, giấy tờ và địa chỉ. | Payload `participants` |
| 16 | `FINANCIAL_INFORMATION_JSON` | CLOB JSON object | Cần chốt cấp nhóm | Thu nhập incomeList và chi phí expenseList theo v1.4. | Payload `financialInformation` |
| 17 | `ADVANCED_PAYMENT_CONDITIONS_JSON` | CLOB JSON array | Không | Điều kiện trước giải ngân. | Payload `advancedPaymentConditions` |
| 18 | `COLLATERALS_JSON` | CLOB JSON array | Có điều kiện | Tài sản bảo đảm, chủ sở hữu và hồ sơ pháp lý. | Payload `collaterals` |
| 19 | `DOCUMENTS_ATTACHMENT_JSON` | CLOB JSON array | Chưa quy định | Danh sách tài liệu đính kèm. | Payload `documentsAttachment` |
| 20 | `SUPPLEMENTAL_INTEREST_RATE_JSON` | CLOB JSON array | Có điều kiện | Chương trình, các kỳ lãi suất và phí trả trước hạn. | Payload `supplementalInterestRateInformation` |
| 21 | `DISBURSEMENT_INFORMATION_JSON` | CLOB JSON object | Cần chốt cấp nhóm | Ngân hàng và tài khoản thụ hưởng. | Payload `disbursementInformation` |
| 22 | `LOAN_REPAYMENT_INFORMATION_JSON` | CLOB JSON object | Cần chốt cấp nhóm | Tài khoản và lịch trả nợ. | Payload `loanRepaymentInformation` |

Quy ước: datatype/độ dài DB là đề xuất thiết kế. Mức bắt buộc của các property thay đổi theo bảng đặc tả v1.4; các field tham chiếu kế thừa BP-6.1. Field matrix hiện có lấy từ v1.1 nên chưa dùng làm nguồn chuẩn cho các thay đổi v1.4; property con bắt buộc không tự động đồng nghĩa cả nhóm cha bắt buộc trong mọi trường hợp. DDL để các nhóm chưa chốt nullable, consumer kiểm tra điều kiện nghiệp vụ trước khi insert.

## 3. Quy tắc tách và lưu JSON

- HEADER_JSON là object header sau khi bỏ hai field đã lưu thành cột riêng.
- PAYLOAD_JSON là object payload sau khi bỏ 9 field scalar cấp đầu và 9 nhóm JSON đã tách thành cột riêng.
- Không thêm wrapper application/approval hoặc đổi tên property của message.
- Mỗi cột nhóm JSON lưu nguyên giá trị nguồn: array dạng [ {...}, {...} ] hoặc object dạng { ... }. PARTICIPANTS_JSON giữ đầy đủ CIF, fullName và documents[].documentNumber của từng participant.
- Giữ nguyên thứ tự array và các cấu trúc lồng nhau trong nhóm cha.
- Field nhóm không gửi hoặc có giá trị null được lưu SQL NULL; array rỗng lưu [] và object rỗng lưu {}. Quy tắc này gộp trường hợp thiếu field và explicit null ở cột riêng.
- Property trong HEADER_JSON/PAYLOAD_JSON giữ nguyên trạng thái không gửi, null và datatype của dữ liệu nguồn.
- Các field mới chưa có mapping được giữ trong JSON còn lại; nếu có thêm nhóm object/array mới thì rà soát mapping trước khi bổ sung cột.
- Đây là dữ liệu đã phân tách, không phải bản lưu nguyên byte của Kafka record.

Ví dụ PARTICIPANTS_JSON lưu đầy đủ CIF, fullName và giấy tờ trong từng participant:

~~~json
[
  {
    "role": "borrower",
    "CIF": "00001234",
    "fullName": "Nguyễn Văn A",
    "documents": [
      {
        "documentType": "nationalID",
        "documentNumber": "012345678901",
        "isMain": true
      }
    ],
    "addressInfo": [
      {
        "addressType": "permanent",
        "fullAddress": "Hà Nội"
      }
    ]
  }
]
~~~

Trong ví dụ, CIF, fullName và documentNumber đều được giữ đúng vị trí trong JSON. Ví dụ chỉ minh họa cấu trúc lưu, không phải message đầy đủ để validate required.

### 3.1. Quy tắc đưa 3 field cấp đầu ra cột riêng

| Field Kafka | Cột DB | Quy tắc tách |
|---|---|---|
| `productText` | `PRODUCT_TEXT` | Đọc ở cấp đầu payload, loại khỏi PAYLOAD_JSON. |
| `approvalDate` | `APPROVAL_DATE` | Parse chuỗi DateTime kèm timezone, loại khỏi PAYLOAD_JSON. Nếu không gửi thì lưu NULL. |
| `approvalLevel` | `APPROVAL_LEVEL` | Đọc ở cấp đầu payload, loại khỏi PAYLOAD_JSON. |

Toàn bộ participants[] được giữ nguyên trong PARTICIPANTS_JSON, bao gồm CIF, fullName, documents[] và addressInfo[] của từng người vay/đồng vay/người liên quan. Không cần chọn một participant để tách dữ liệu ra cột scalar; giữ nguyên thứ tự participant và giấy tờ.

Khi tra cứu CIF hoặc tên khách hàng, đọc CIF/fullName trong từng participant; lọc role = borrower nếu nghiệp vụ chỉ tìm người vay chính. Khi tra cứu CCCD/CMND, đọc documents[] và lọc documentType phù hợp. Những điều kiện tra cứu này không thay đổi cấu trúc lưu JSON.

## 4. Cấu hình chi tiết 11 cột JSON

JSON path trong các bảng dưới đây tính từ gốc của từng cột JSON, không phải từ gốc toàn bộ Kafka payload.

### 4.1. HEADER_JSON

- Kiểu gốc: JSON object.
- Nguồn: command header sau khi tách dqMessageGuid và correlationId.
- spring_json_header_types được giữ lồng trong HEADER_JSON, không có cột vật lý riêng.

| JSON path tương đối | Kiểu | Bắt buộc | Ý nghĩa |
|---|---|---|---|
| `$.contentType` | String | Có | Định dạng payload, ví dụ application/json. |
| `$.producer` | String | Có | Hệ thống phát command. |
| `$.sender` | String | Có | Nguồn/trigger phát command. |
| `$.spring_json_header_types` | Object | Có | Khai báo kiểu Java/Spring của các header. |
| &nbsp;&nbsp;↳ `$.spring_json_header_types.dqMessageGuid` | String | Có | Class của header dqMessageGuid; không phải GUID message. |
| &nbsp;&nbsp;↳ `$.spring_json_header_types.correlationId` | String | Có | Class của header correlationId; không phải mã tương quan. |
| &nbsp;&nbsp;↳ `$.spring_json_header_types.contentType` | String | Có | Class của header contentType. |
| &nbsp;&nbsp;↳ `$.spring_json_header_types.producer` | String | Có | Class của header producer. |
| &nbsp;&nbsp;↳ `$.spring_json_header_types.sender` | String | Có | Class của header sender. |

Consumer parse header spring_json_header_types thành object trước khi lưu. Các property này có giá trị ví dụ java.lang.String.

### 4.2. PAYLOAD_JSON

- Kiểu gốc: JSON object.
- Chứa 51 field scalar cấp đầu dưới đây, nếu chúng xuất hiện trong message.
- Không chứa 9 field scalar cấp đầu hay 9 nhóm đã tách; không có object/array đã biết trong cấu trúc Phase 1.1.
- Date/DateTime giữ dạng chuỗi theo nguồn; các khoản tiền/tỷ lệ vẫn là JSON number.

| JSON path tương đối | Kiểu | Bắt buộc | Ý nghĩa |
|---|---|---|---|
| `$.applicationType` | String | Có | Hình thức cấp tín dụng. |
| `$.stateSysName` | String | Có | Mã state của hồ sơ nguồn. |
| `$.state` | String | Có | Tên state của hồ sơ nguồn. |
| `$.statusSysName` | String | Có | Mã trạng thái xử lý của hồ sơ nguồn. |
| `$.status` | String | Có | Tên trạng thái của hồ sơ nguồn. |
| `$.createdByName` | String | Có | Tên người khởi tạo hồ sơ. |
| `$.createdByNameLogin` | String | Có | Login người khởi tạo hồ sơ. |
| `$.creationDate` | DateTime string | Có | Thời điểm hồ sơ được tạo tại nguồn. |
| `$.customerSegment` | String | Có | Mã phân khúc khách hàng. |
| `$.customerSegmentText` | String | Có | Tên phân khúc khách hàng. |
| `$.scoreType` | String | Không | Loại xếp hạng tín dụng. |
| `$.originalAppID` | String | Không | Mã hồ sơ gốc. |
| `$.partnershipDetailsCode` | String | Không | Mã đối tác cụ thể. |
| `$.agentText` | String | Không | Tên người môi giới/đại lý. |
| `$.agentCode` | String | Không | Mã người môi giới/đại lý. |
| `$.sellerCode` | String | Không | Mã cán bộ bán hàng/MIS code. |
| `$.sellerName` | String | Không | Tên cán bộ bán hàng. |
| `$.controlLevel` | String | Có | Mã cấp kiểm soát. |
| `$.controlLevelText` | String | Có | Tên cấp kiểm soát. |
| `$.fileControlFlow` | String | Có | Luồng kiểm soát hồ sơ. |
| `$.branchManagerUser` | String | Không | User kiểm soát cấp 2/Giám đốc đơn vị kinh doanh. |
| `$.supervisoryEmployeeLogin` | String | Có | User kiểm soát cấp 1/Team Lead/GĐKHCN. |
| `$.productType` | String | Có | Mã loại sản phẩm. |
| `$.productTypeText` | String | Có | Tên loại sản phẩm. |
| `$.productGroupSysName` | String | Có | Mã nhóm sản phẩm. |
| `$.productGroupText` | String | Có | Tên nhóm sản phẩm. |
| `$.specificProductCodeUDF` | String | Không | Mã sản phẩm cụ thể/UDF. |
| `$.loanPurpose` | String | Có | Mã mục đích vay. |
| `$.loanPurposeName` | String | Có | Tên mục đích vay. |
| `$.loanPurposeDetails` | String | Không | Mục đích vay chi tiết. |
| `$.totalCapitalRequirement` | Number | Không | Tổng nhu cầu vốn. |
| `$.ownedCapital` | Number | Không | Vốn tự có. |
| `$.loanToValueRatio` | Number | Có | Tỷ lệ cho vay. |
| `$.loanTerm` | Number | Có | Thời hạn vay; cần thống nhất đơn vị với hệ thống nguồn. |
| `$.principalGracePeriod` | Number | Có | Thời gian ân hạn gốc. |
| `$.interestGracePeriod` | Number | Có | Thời gian ân hạn lãi. |
| `$.loanMethod` | String | Có | Mã phương thức cho vay. |
| `$.loanMethodName` | String | Có | Tên phương thức cho vay. |
| `$.disbursementMethod` | String | Có | Mã phương thức giải ngân. |
| `$.disbursementMethodName` | String | Có | Tên phương thức giải ngân. |
| `$.principalRepaymentMethod` | String | Có | Mã phương thức trả nợ gốc trong approval. |
| `$.principalRepaymentMethodName` | String | Có | Tên phương thức trả nợ gốc trong approval. |
| `$.interestRepaymentMethod` | String | Có | Mã phương thức trả nợ lãi trong approval. |
| `$.interestRepaymentMethodName` | String | Có | Tên phương thức trả nợ lãi trong approval. |
| `$.afterPaymentConditions` | String | Không | Điều kiện sau giải ngân. |
| `$.approvalDecision` | String | Không | Mã kết quả phê duyệt theo bảng đặc tả. |
| `$.approvalDecisionName` | String | Không | Tên kết quả phê duyệt theo bảng đặc tả. |
| `$.approvalSysName` | String | Chưa quy định | Mã kết quả phê duyệt xuất hiện trong JSON example. Giữ riêng với approvalDecision. |
| `$.approvalName` | String | Chưa quy định | Tên kết quả phê duyệt xuất hiện trong JSON example. Giữ riêng với approvalDecisionName. |
| `$.approvalNote` | String | Chưa quy định | Ghi chú/ý kiến phê duyệt. |
| `$.approvalBy` | String | Chưa quy định | Login/người thực hiện phê duyệt. |

Giữ riêng approvalDecision/approvalDecisionName và approvalSysName/approvalName đúng theo message thực tế; không tự gộp hoặc fallback giữa hai bộ tên chưa thống nhất.

### 4.3. EXCEPTION_CONDITIONS_JSON

- Kiểu gốc: JSON array.
- Nguồn: payload exceptionConditions.

| JSON path tương đối | Kiểu | Bắt buộc | Ý nghĩa |
|---|---|---|---|
| $[*].reasonException | String | Không | Mã/loại lý do ngoại lệ. |
| $[*].reasonExceptionText | String | Không | Tên lý do ngoại lệ. |
| $[*].exceptionConditions | String | Không | Nội dung điều kiện ngoại lệ. |

### 4.4. PARTICIPANTS_JSON

- Kiểu gốc: JSON array.
- Nguồn: payload participants.
- V1.4 mở rộng nhóm này cho người vay chính, người đồng vay và người liên quan; ví dụ role = related.
- documents và addressInfo được giữ lồng trong từng participant.
- Giữ nguyên CIF, fullName và documentNumber của mọi participant; không loại property nào khỏi nhóm này.
- Bảng mở rộng v1.4 mô tả phần người liên quan; không áp dụng mặc định các field cá nhân như birthDate/gender cho participant pháp nhân. Required của borrower/coborrower tiếp tục đối chiếu nhóm tham chiếu BP-6.1.
- incomeList của contract v1.4 nằm ở financialInformation cấp đầu, không nằm trong participant.

| JSON path tương đối | Kiểu | Bắt buộc | Ý nghĩa |
|---|---|---|---|
| $[*].role | String | Có | Vai trò participant: borrower/coborrower và related được mở rộng trong v1.4. |
| $[*].type | String | Không | Loại participant; ví dụ individual hoặc legal. |
| $[*].status | String | Không | Trạng thái participant; ví dụ Active. |
| $[*].relationship | String | Không | Mã quan hệ với người vay; v1.4 bổ sung mapping cho role = related. |
| $[*].relationshipText | String | Không | Tên quan hệ; ví dụ HKD members. |
| $[*].detailsText | String | Không | Nội dung chi tiết của người liên quan. |
| $[*].details2Text | String | Không | Nội dung chi tiết bổ sung của người liên quan. |
| $[*].fullName | String | Không trong bảng mở rộng v1.4 | Họ tên/tên participant; required của borrower/coborrower theo BP-6.1. |
| $[*].businessRegistrationNumber | String | Không | Số đăng ký kinh doanh của participant. |
| $[*].legalRepresentative | String | Không | Người đại diện pháp luật. |
| $[*].birthDate | Date/DateTime string | Theo role và BP-6.1 | Ngày sinh của participant cá nhân; v1.4 không định nghĩa field này cho người liên quan/pháp nhân. |
| $[*].gender | String | Theo role và BP-6.1 | Giới tính của participant cá nhân; v1.4 không định nghĩa field này cho người liên quan/pháp nhân. |
| $[*].CIF | String | Không | Mã CIF của từng participant; giữ dạng chuỗi. |
| $[*].outstandingBank | Number | Không | Dư nợ tại ngân hàng. |
| $[*].creditLimit | Number | Không | Hạn mức tín dụng. |
| $[*].mobileNumber | String | Theo BP-6.1 | Số điện thoại; không đổi cấu trúc field tham chiếu. |
| $[*].email | String | Theo BP-6.1 | Email; không đổi cấu trúc field tham chiếu. |
| $[*].documents | Array | Chưa quy định cấp nhóm | Danh sách giấy tờ; các property con required khi nhóm giấy tờ được gửi. |
| $[*].addressInfo | Array | Theo role và BP-6.1 | Danh sách địa chỉ; cấu trúc tham chiếu của participant cá nhân. |

#### participants[].documents[]

| JSON path tương đối | Kiểu | Bắt buộc | Ý nghĩa |
|---|---|---|---|
| $[*].documents[*].documentType | String | Có | Mã loại giấy tờ. |
| $[*].documents[*].documentTypeText | String | Có | Tên loại giấy tờ. |
| $[*].documents[*].isMain | Boolean | Không | Đánh dấu giấy tờ chính. |
| $[*].documents[*].documentNumber | String | Có | Số giấy tờ định danh, giữ dạng chuỗi trong từng phần tử documents[] của tất cả participant. |
| $[*].documents[*].dateIssued | Date/DateTime string | Có | Ngày cấp. |
| $[*].documents[*].placeIssued | String | Có | Nơi/cơ quan cấp. |

#### participants[].addressInfo[]

| JSON path tương đối | Kiểu | Bắt buộc | Ý nghĩa |
|---|---|---|---|
| $[*].addressInfo[*].addressType | String | Có | Loại địa chỉ: permanent hoặc residential. |
| $[*].addressInfo[*].provinceText | String | Có | Tỉnh/thành phố. |
| $[*].addressInfo[*].districtText | String | Có | Quận/huyện/phường/xã theo dữ liệu nguồn. |
| $[*].addressInfo[*].addressDetail | String | Có | Địa chỉ chi tiết. |
| $[*].addressInfo[*].fullAddress | String | Có | Địa chỉ đầy đủ. |

### 4.5. FINANCIAL_INFORMATION_JSON

- Kiểu gốc: **JSON object** theo v1.4; không còn là array như mô tả v1.1.
- Nguồn: payload financialInformation.
- Gốc JSON chứa incomeList[] và expenseList[].
- Bỏ averageTotalMonthlyIncome và incomeList[].details[] khỏi schema hiện hành: các field này không còn trong bảng đặc tả v1.4.
- Mapping dữ liệu cho flow BU/F lấy từ thông tin tài chính và chi phí tính bởi ĐVKD; flow N lấy từ phần đánh giá thu nhập/chi phí của chuyên viên thẩm định.

| JSON path tương đối | Kiểu | Bắt buộc | Ý nghĩa |
|---|---|---|---|
| $.incomeList | Array | Chưa quy định cấp nhóm | Danh sách nguồn thu. |
| &nbsp;&nbsp;↳ $.incomeList[*].incomeType | String | Có | Mã loại nguồn thu. |
| &nbsp;&nbsp;↳ $.incomeList[*].incomeTypeText | String | Có | Tên loại nguồn thu. |
| &nbsp;&nbsp;↳ $.incomeList[*].ownerIncome | String | Có | Người sở hữu nguồn thu. |
| &nbsp;&nbsp;↳ $.incomeList[*].averageIncome | Number | Có | Thu nhập trung bình tháng. |
| &nbsp;&nbsp;↳ $.incomeList[*].additionalComments | String | Không | Ghi chú bổ sung. |
| $.expenseList | Array | Chưa quy định cấp nhóm | Danh sách chỉ tiêu chi phí/nghĩa vụ trả nợ. |
| &nbsp;&nbsp;↳ $.expenseList[*].indicatorSysName | String | Không | Mã chỉ tiêu: otherCreditInstDebtRepaymentCost, creditCardBalancePercent hoặc debtRepaymentCostThisLoan. |
| &nbsp;&nbsp;↳ $.expenseList[*].indicatorName | String | Không | Tên chỉ tiêu chi phí. |
| &nbsp;&nbsp;↳ $.expenseList[*].value | Number | Không | Giá trị chỉ tiêu theo bảng đặc tả v1.4. |
| &nbsp;&nbsp;↳ $.expenseList[*].indicatorValue | Number | Chưa quy định trong bảng đặc tả | Tên field xuất hiện trong JSON example v1.4 thay cho value; cần thống nhất contract. |

**Điểm chưa thống nhất:** bảng đặc tả ghi expenseList[].value, nhưng Example 1 - Command dùng expenseList[].indicatorValue. Khi lưu JSON, giữ nguyên key nguồn gửi; không tự đổi tên hoặc tạo thêm key. Consumer cần thống nhất tên field với producer trước khi validate/map nghiệp vụ; không tự gộp nếu message có cả hai key.

Ví dụ hình dạng object lấy từ Example 1 - Command v1.4:

~~~json
{
  "incomeList": [
    {
      "incomeTypeText": "Other sources of income",
      "ownerIncome": "Poker Face - Borrower",
      "averageIncome": 32623123,
      "additionalComments": "Text"
    }
  ],
  "expenseList": [
    {
      "indicatorSysName": "otherCreditInstDebtRepaymentCost",
      "indicatorName": "Other Credit Institution Debt Repayment Costs",
      "indicatorValue": 312314234234
    },
    {
      "indicatorSysName": "creditCardBalancePercent",
      "indicatorName": "5% Credit Card Balance",
      "indicatorValue": 5
    },
    {
      "indicatorSysName": "debtRepaymentCostThisLoan",
      "indicatorName": "Debt Repayment Costs for This Loan",
      "indicatorValue": 312314234234
    }
  ]
}
~~~

Example thiếu incomeType dù bảng đặc tả ghi required; giữ nguyên dữ liệu example để minh họa cấu trúc, không tự điền mã nguồn thu.

### 4.6. ADVANCED_PAYMENT_CONDITIONS_JSON

- Kiểu gốc: JSON array.
- Nguồn: payload advancedPaymentConditions.

| JSON path tương đối | Kiểu | Bắt buộc | Ý nghĩa |
|---|---|---|---|
| $[*].advancedPaymentCondition | String | Không | Nội dung điều kiện trước giải ngân. |

### 4.7. COLLATERALS_JSON

- Kiểu gốc: JSON array.
- Nguồn: payload collaterals.
- owners và legalDocuments được giữ lồng trong từng tài sản.

| JSON path tương đối | Kiểu | Bắt buộc | Ý nghĩa |
|---|---|---|---|
| $[*].collateral | String | Không | Nội dung tóm tắt tài sản bảo đảm/LTV. |
| $[*].collateralType | String | Có | Mã loại tài sản bảo đảm. |
| $[*].collateralTypeText | String | Có | Tên loại tài sản bảo đảm. |
| $[*].owners | Array | Không | Danh sách chủ sở hữu tài sản. |
| $[*].collateralCode | String | Không | Mã tài sản bảo đảm; Example 1 - Command v1.4 bổ sung giá trị Text. |
| $[*].collateralDescription | String | Không | Mô tả tài sản. |
| $[*].estimatedValue | Number | Không | Giá trị ước tính/cấp tín dụng của tài sản. |
| $[*].vehicleType | String | Không | Mã loại xe. |
| $[*].vehicleTypeText | String | Không | Tên loại xe. |
| $[*].vehicleConditionText | String | Không | Tình trạng xe. |
| $[*].carBrandText | String | Không | Thương hiệu xe. |
| $[*].carModelText | String | Không | Model xe. |
| $[*].chassisNumber | String | Không | Số khung. |
| $[*].engineNumber | String | Không | Số máy. |
| $[*].carYear | Number | Không | Năm sản xuất. |
| $[*].carCountryText | String | Không | Nước sản xuất. |
| $[*].licensePlate | String | Không | Biển kiểm soát. |
| $[*].carColor | String | Không | Màu xe. |
| $[*].registrationNumber | String | Không | Số đăng ký xe. |
| $[*].detailedCollateralTypeText | String | Không | Tên loại tài sản chi tiết. |
| $[*].lotNumber | String | Không | Số thửa đất. |
| $[*].mapSheetNumber | String | Không | Số tờ bản đồ. |
| $[*].certNumber | String | Không | Số giấy chứng nhận. |
| $[*].legalDocuments | Array | Không | Danh sách hồ sơ pháp lý. |

#### collaterals[].owners[]

| JSON path tương đối | Kiểu | Bắt buộc | Ý nghĩa |
|---|---|---|---|
| $[*].owners[*].ownerFullName | String | Không | Họ tên chủ sở hữu. |
| $[*].owners[*].relationshipType | String | Không | Mã quan hệ giữa chủ tài sản và khách hàng. |
| $[*].owners[*].relationshipTypeText | String | Không | Tên quan hệ giữa chủ tài sản và khách hàng. |

#### collaterals[].legalDocuments[]

| JSON path tương đối | Kiểu | Bắt buộc | Ý nghĩa |
|---|---|---|---|
| $[*].legalDocuments[*].documentType | String | Không | Mã loại hồ sơ pháp lý. |
| $[*].legalDocuments[*].documentTypeOther | String | Không | Tên loại hồ sơ pháp lý khác. |
| $[*].legalDocuments[*].documentTypeText | String | Không | Tên hiển thị của hồ sơ pháp lý. |
| $[*].legalDocuments[*].documentNumber | String | Không | Số văn bản/hồ sơ. |
| $[*].legalDocuments[*].documentIssuePlace | String | Không | Nơi cấp. |
| $[*].legalDocuments[*].documentIssueDate | Date/DateTime string | Không | Ngày cấp. |

### 4.8. DOCUMENTS_ATTACHMENT_JSON

- Kiểu gốc: JSON array.
- Nguồn: payload documentsAttachment.

| JSON path tương đối | Kiểu | Bắt buộc | Ý nghĩa |
|---|---|---|---|
| $[*].docId | String | Chưa quy định | ID tài liệu. |
| $[*].typeSysName | String | Chưa quy định | Mã loại tài liệu. |
| $[*].typeName | String | Chưa quy định | Tên loại tài liệu. |
| $[*].attachName | String | Chưa quy định | Tên file/tài liệu. |
| $[*].attachCreator | String | Chưa quy định | User tạo/tải tài liệu. |
| $[*].attachCreateDate | DateTime string | Chưa quy định | Thời điểm tạo/tải tài liệu. |

### 4.9. SUPPLEMENTAL_INTEREST_RATE_JSON

- Kiểu gốc: JSON array.
- Nguồn: payload supplementalInterestRateInformation.
- appInterestRates và earlyRepaymentFees được giữ lồng trong từng chương trình.

| JSON path tương đối | Kiểu | Bắt buộc | Ý nghĩa |
|---|---|---|---|
| $[*].appStateDataSource | String | Có | Nguồn dữ liệu: draftContract hoặc disbursementRequest. |
| $[*].promotionProgram | String | Có | Mã chương trình ưu đãi. |
| $[*].promotionProgramText | String | Có | Tên chương trình ưu đãi. |
| $[*].appInterestRates | Array | Có | Danh sách kỳ/mức lãi suất. |
| $[*].earlyRepaymentFees | Array | Có | Danh sách phí trả nợ trước hạn. |

#### supplementalInterestRateInformation[].appInterestRates[]

| JSON path tương đối | Kiểu | Bắt buộc | Ý nghĩa |
|---|---|---|---|
| $[*].appInterestRates[*].period | Number | Có | Số thứ tự kỳ. |
| $[*].appInterestRates[*].interestRatePlan | String | Có | Phương án lãi suất. |
| $[*].appInterestRates[*].gracePeriod | Number | Có | Thời gian ưu đãi theo tháng. |
| $[*].appInterestRates[*].interestRatePref | Number | Có | Lãi suất ưu đãi. |
| $[*].appInterestRates[*].rateCode | String | Có | Mã lãi suất ưu đãi. |
| $[*].appInterestRates[*].interestRateMargin | Number | Có | Biên độ lãi suất. |
| $[*].appInterestRates[*].interestRateAdjustmentPeriodText | String | Có | Kỳ thay đổi lãi suất. |
| $[*].appInterestRates[*].interestRateDetail | String | Có | Mô tả chi tiết lãi suất. |

#### supplementalInterestRateInformation[].earlyRepaymentFees[]

| JSON path tương đối | Kiểu | Bắt buộc | Ý nghĩa |
|---|---|---|---|
| $[*].earlyRepaymentFees[*].periodFee | Number | Có | Số thứ tự kỳ phí. |
| $[*].earlyRepaymentFees[*].applicablePeriodFee | Number | Có | Thời gian áp dụng theo tháng. |
| $[*].earlyRepaymentFees[*].rateFee | Number | Có | Mức phí theo phần trăm. |

### 4.10. DISBURSEMENT_INFORMATION_JSON

- Kiểu gốc: JSON object.
- Nguồn: payload disbursementInformation.
- V1.4 bổ sung beneficiaryBankId bên cạnh beneficiary và beneficiaryText; ba field này được lưu riêng.

| JSON path tương đối | Kiểu | Bắt buộc | Ý nghĩa |
|---|---|---|---|
| $.beneficiaryBankId | Number | Có | Bank ID của ngân hàng thụ hưởng; bảng đặc tả v1.4 cho ví dụ 970423. |
| $.beneficiary | String | Có | Giá trị/mã ngân hàng thụ hưởng theo contract; không tự thay bằng beneficiaryBankId. |
| $.beneficiaryText | String | Có | Tên ngân hàng thụ hưởng. |
| $.payeeAccountNumber | String | Có | Số tài khoản thụ hưởng. |
| $.payeeName | String | Có | Tên người/chủ tài khoản thụ hưởng. |

**Điểm chưa thống nhất:** beneficiaryBankId có type Number trong bảng đặc tả nhưng ví dụ field riêng ghi giá trị có dấu nháy; JSON Example 1 - Command lại chưa có beneficiaryBankId. Schema hiện hành ghi nhận Number theo cột Type; không tự điền Bank ID vào dữ liệu example và không sửa dữ liệu nguồn khi lưu JSON.

### 4.11. LOAN_REPAYMENT_INFORMATION_JSON

- Kiểu gốc: JSON object.
- Nguồn: payload loanRepaymentInformation.

| JSON path tương đối | Kiểu | Bắt buộc | Ý nghĩa |
|---|---|---|---|
| $.repaymentAccountNumber | String | Có | Số tài khoản trả nợ. |
| $.principalRepaymentMethod | String | Có | Kỳ/phương thức trả nợ gốc. |
| $.scheduledPrincipalPaymentDate | Number | Có | Ngày trả nợ gốc định kỳ. |
| $.interestPaymentMethod | String | Có | Kỳ/phương thức trả nợ lãi. |
| $.scheduledInterestPaymentDate | Number | Có | Ngày trả nợ lãi định kỳ. |
| $.firstPrincipalPaymentDate | Date/DateTime string | Có | Ngày trả nợ gốc đầu tiên. |
| $.firstInterestPaymentDate | Date/DateTime string | Có | Ngày trả nợ lãi đầu tiên. |
| $.detailedRepaymentScheduleData | String | Không | Lịch trả nợ chi tiết. |

## 5. DDL của bảng 22 cột

DDL gồm tạo bảng, comment cho bảng và đầy đủ 22 cột, cùng các index tra cứu. Comment ghi rõ ý nghĩa nghiệp vụ, field nguồn Kafka và cách lưu các nhóm JSON.

~~~sql
CREATE TABLE DISBURSEMENT_COMMAND (
    DQ_MESSAGE_GUID                     VARCHAR2(36 CHAR) NOT NULL,
    CORRELATION_ID                      VARCHAR2(36 CHAR) NOT NULL,
    APP_NUMBER                          VARCHAR2(50 CHAR) NOT NULL,
    LEAD_ID                             NUMBER(19) NOT NULL,
    BRANCH_CODE                         VARCHAR2(50 CHAR) NOT NULL,
    PRODUCT_SYS_NAME                    VARCHAR2(100 CHAR) NOT NULL,
    OFFERED_LOAN_AMOUNT                 NUMBER(24,4) NOT NULL,
    CURRENCY                            VARCHAR2(10 CHAR),
    PRODUCT_TEXT                        VARCHAR2(255 CHAR) NOT NULL,
    APPROVAL_DATE                       TIMESTAMP(6) WITH TIME ZONE,
    APPROVAL_LEVEL                      VARCHAR2(100 CHAR),
    HEADER_JSON                         CLOB NOT NULL,
    PAYLOAD_JSON                        CLOB NOT NULL,
    EXCEPTION_CONDITIONS_JSON            CLOB,
    PARTICIPANTS_JSON                    CLOB,
    FINANCIAL_INFORMATION_JSON           CLOB,
    ADVANCED_PAYMENT_CONDITIONS_JSON     CLOB,
    COLLATERALS_JSON                     CLOB,
    DOCUMENTS_ATTACHMENT_JSON            CLOB,
    SUPPLEMENTAL_INTEREST_RATE_JSON      CLOB,
    DISBURSEMENT_INFORMATION_JSON        CLOB,
    LOAN_REPAYMENT_INFORMATION_JSON      CLOB,

    CONSTRAINT PK_DISBURSEMENT_COMMAND
        PRIMARY KEY (DQ_MESSAGE_GUID),
    CONSTRAINT CK_CMD_HEADER_JSON
        CHECK (HEADER_JSON IS JSON),
    CONSTRAINT CK_CMD_PAYLOAD_JSON
        CHECK (PAYLOAD_JSON IS JSON),
    CONSTRAINT CK_CMD_EXCEPTIONS_JSON
        CHECK (EXCEPTION_CONDITIONS_JSON IS JSON),
    CONSTRAINT CK_CMD_PARTICIPANTS_JSON
        CHECK (PARTICIPANTS_JSON IS JSON),
    CONSTRAINT CK_CMD_FINANCIAL_JSON
        CHECK (FINANCIAL_INFORMATION_JSON IS JSON),
    CONSTRAINT CK_CMD_ADV_CONDITIONS_JSON
        CHECK (ADVANCED_PAYMENT_CONDITIONS_JSON IS JSON),
    CONSTRAINT CK_CMD_COLLATERALS_JSON
        CHECK (COLLATERALS_JSON IS JSON),
    CONSTRAINT CK_CMD_ATTACHMENTS_JSON
        CHECK (DOCUMENTS_ATTACHMENT_JSON IS JSON),
    CONSTRAINT CK_CMD_INTEREST_RATE_JSON
        CHECK (SUPPLEMENTAL_INTEREST_RATE_JSON IS JSON),
    CONSTRAINT CK_CMD_DISBURSEMENT_INFO_JSON
        CHECK (DISBURSEMENT_INFORMATION_JSON IS JSON),
    CONSTRAINT CK_CMD_REPAYMENT_INFO_JSON
        CHECK (LOAN_REPAYMENT_INFORMATION_JSON IS JSON)
);

COMMENT ON TABLE DISBURSEMENT_COMMAND IS
    'Lưu header và payload command Phase 1.1 theo BP-13.1 v1.4 từ topic qlapin-bpm-disbursement-command. Một dòng tương ứng một command, khóa chính lấy từ header dqMessageGuid. Các trường tra cứu chính lưu thành cột scalar, dữ liệu còn lại lưu JSON.';

COMMENT ON COLUMN DISBURSEMENT_COMMAND.DQ_MESSAGE_GUID IS
    'Định danh duy nhất của command, lấy từ Kafka header dqMessageGuid; dùng làm khóa chính.';

COMMENT ON COLUMN DISBURSEMENT_COMMAND.CORRELATION_ID IS
    'Mã tương quan của command, lấy từ Kafka header correlationId; dùng tra cứu và đối chiếu message.';

COMMENT ON COLUMN DISBURSEMENT_COMMAND.APP_NUMBER IS
    'Mã hồ sơ vay trên QLOS, lấy từ payload appNumber. Một hồ sơ có thể có nhiều command; chưa xác nhận mã này đồng nhất với mã PDTD.';

COMMENT ON COLUMN DISBURSEMENT_COMMAND.LEAD_ID IS
    'Mã lead khách hàng, lấy từ payload leadId; lưu kiểu số theo contract Long.';

COMMENT ON COLUMN DISBURSEMENT_COMMAND.BRANCH_CODE IS
    'Mã chi nhánh/đơn vị kinh doanh, lấy từ payload branchCode.';

COMMENT ON COLUMN DISBURSEMENT_COMMAND.PRODUCT_SYS_NAME IS
    'Mã sản phẩm tín dụng, lấy từ payload productSysName.';

COMMENT ON COLUMN DISBURSEMENT_COMMAND.OFFERED_LOAN_AMOUNT IS
    'Số tiền vay được đề xuất/phê duyệt, lấy từ payload offeredLoanAmount; không mặc định là số tiền của từng lần giải ngân.';

COMMENT ON COLUMN DISBURSEMENT_COMMAND.CURRENCY IS
    'Đồng tiền khoản vay, lấy từ payload currency; có thể NULL khi message không gửi.';

COMMENT ON COLUMN DISBURSEMENT_COMMAND.PRODUCT_TEXT IS
    'Tên sản phẩm tín dụng, lấy từ payload productText; đã tách khỏi PAYLOAD_JSON.';

COMMENT ON COLUMN DISBURSEMENT_COMMAND.APPROVAL_DATE IS
    'Thời điểm phê duyệt, lấy từ payload approvalDate và chuyển sang timestamp kèm timezone; đã tách khỏi PAYLOAD_JSON. Có thể NULL khi message không gửi.';

COMMENT ON COLUMN DISBURSEMENT_COMMAND.APPROVAL_LEVEL IS
    'Cấp phê duyệt, lấy từ payload approvalLevel; đã tách khỏi PAYLOAD_JSON.';

COMMENT ON COLUMN DISBURSEMENT_COMMAND.HEADER_JSON IS
    'JSON object chứa các header còn lại sau khi tách dqMessageGuid và correlationId: contentType, producer, sender và spring_json_header_types. Giữ spring_json_header_types dưới dạng object lồng nhau.';

COMMENT ON COLUMN DISBURSEMENT_COMMAND.PAYLOAD_JSON IS
    'JSON object chứa 51 field scalar cấp đầu còn lại của payload khi chúng có mặt, sau khi tách 9 field scalar ra cột riêng và 9 nhóm object/array ra các cột JSON riêng. Giữ nguyên tên property và datatype nguồn.';

COMMENT ON COLUMN DISBURSEMENT_COMMAND.EXCEPTION_CONDITIONS_JSON IS
    'JSON array lấy từ payload exceptionConditions, chứa các lý do và điều kiện ngoại lệ; giữ nguyên property của từng phần tử.';

COMMENT ON COLUMN DISBURSEMENT_COMMAND.PARTICIPANTS_JSON IS
    'JSON array lấy nguyên từ payload participants theo v1.4; chứa người vay chính, đồng vay và người liên quan. Giữ CIF, fullName, type, status, detailsText, details2Text, businessRegistrationNumber, legalRepresentative, outstandingBank, creditLimit khi có; documents và addressInfo lồng trong participant. documentNumber nằm trong documents[]. Giữ thứ tự array và datatype nguồn.';

COMMENT ON COLUMN DISBURSEMENT_COMMAND.FINANCIAL_INFORMATION_JSON IS
    'JSON object lấy từ payload financialInformation theo v1.4; gồm incomeList[] và expenseList[]. Thu nhập gồm incomeType, incomeTypeText, ownerIncome, averageIncome, additionalComments. Chi phí gồm indicatorSysName, indicatorName và giá trị; đặc tả dùng value, example dùng indicatorValue. Giữ nguyên key nguồn. Schema v1.4 không còn averageTotalMonthlyIncome hay incomeList[].details[].';

COMMENT ON COLUMN DISBURSEMENT_COMMAND.ADVANCED_PAYMENT_CONDITIONS_JSON IS
    'JSON array lấy từ payload advancedPaymentConditions; từng phần tử chứa nội dung điều kiện trước giải ngân tại advancedPaymentCondition.';

COMMENT ON COLUMN DISBURSEMENT_COMMAND.COLLATERALS_JSON IS
    'JSON array lấy từ payload collaterals; lưu thông tin tài sản bảo đảm, owners và legalDocuments lồng trong từng tài sản. Các documentNumber thuộc hồ sơ pháp lý tài sản được giữ nguyên trong JSON. Example v1.4 bổ sung collateralCode.';

COMMENT ON COLUMN DISBURSEMENT_COMMAND.DOCUMENTS_ATTACHMENT_JSON IS
    'JSON array lấy từ payload documentsAttachment; lưu ID tài liệu, loại tài liệu, tên file, người tạo và thời điểm tạo/tải tài liệu.';

COMMENT ON COLUMN DISBURSEMENT_COMMAND.SUPPLEMENTAL_INTEREST_RATE_JSON IS
    'JSON array lấy từ payload supplementalInterestRateInformation; giữ chương trình ưu đãi, appInterestRates và earlyRepaymentFees lồng trong từng phần tử.';

COMMENT ON COLUMN DISBURSEMENT_COMMAND.DISBURSEMENT_INFORMATION_JSON IS
    'JSON object lấy từ payload disbursementInformation theo v1.4; gồm beneficiaryBankId (Number, required), beneficiary, beneficiaryText, payeeAccountNumber và payeeName. beneficiaryBankId chưa có trong JSON example v1.4; không tự điền dữ liệu thiếu. Số tài khoản giữ dạng chuỗi.';

COMMENT ON COLUMN DISBURSEMENT_COMMAND.LOAN_REPAYMENT_INFORMATION_JSON IS
    'JSON object lấy từ payload loanRepaymentInformation; chứa tài khoản trả nợ, kỳ/ngày trả gốc và lãi, ngày trả đầu tiên và lịch trả nợ chi tiết. Giữ số tài khoản dạng chuỗi và DateTime theo nguồn.';

CREATE INDEX IDX_DISB_COMMAND_CORRELATION
    ON DISBURSEMENT_COMMAND (CORRELATION_ID);

CREATE INDEX IDX_DISB_COMMAND_APP_NUMBER
    ON DISBURSEMENT_COMMAND (APP_NUMBER);
~~~

## 6. Kiểm tra dữ liệu và ghép lại cấu trúc command

IS JSON xác nhận cú pháp JSON. Consumer kiểm tra datatype và property bắt buộc của message nguồn trước khi tách, sau đó kiểm tra kiểu object/array và cấu trúc lưu theo mục 3–4. Theo v1.4, FINANCIAL_INFORMATION_JSON phải là object; PARTICIPANTS_JSON là array và giữ nguyên dữ liệu.

Required phải được xét theo role và nhóm thực tế gửi. Ghi nhận rõ hai điểm contract chưa thống nhất ở mục 4.5 (value/indicatorValue) và 4.10 (beneficiaryBankId). Constraint IS JSON không tự phát hiện thiếu property hoặc sai kiểu gốc; không coi việc insert thành công là đã validate đủ contract.

Khi tách payload, loại đúng 18 key cấp đầu: 9 field scalar và 9 nhóm JSON. Giữ nguyên toàn bộ các nhóm JSON, bao gồm CIF, fullName và documentNumber của tất cả participant; không loại key lồng nhau.

Khi cần ghép lại command:

1. Header: ghép HEADER_JSON với dqMessageGuid và correlationId từ cột riêng.
2. Payload: ghép PAYLOAD_JSON với 9 field scalar cấp đầu theo tên Kafka trong mục 2. Các field tùy chọn có cột NULL không tự thêm vào payload.
3. Gắn 9 nhóm JSON về đúng tên field cấp đầu của payload. PARTICIPANTS_JSON đã chứa đầy đủ CIF, fullName và documents[].documentNumber; không cần ghép lại property con. Chỉ gắn các nhóm có dữ liệu; [] và {} vẫn được giữ.
4. Kiểm tra key không bị trùng giữa JSON còn lại và cột riêng.

APP_NUMBER không unique vì một hồ sơ có thể có nhiều command GUID khác nhau. Cùng DQ_MESSAGE_GUID không tạo dòng mới. LEAD_ID là số theo contract; CIF, số tài khoản, documentNumber và các định danh dạng chuỗi trong JSON vẫn giữ dạng chuỗi.

Các cột scalar tùy chọn gộp thiếu field và explicit null thành SQL NULL. APPROVAL_DATE lưu giá trị thời gian kèm timezone, không giữ nguyên định dạng chuỗi đầu vào. Vì vậy cấu trúc ghép lại phục vụ nghiệp vụ, không bảo đảm giống từng byte với message gốc.

## 7. Bản ghi mẫu lịch sử lấy từ Word v1.1

Phần này giữ dữ liệu mẫu v1.1 để đối chiếu lịch sử. File INSERT liên kết chưa được cập nhật theo v1.4; incomeList trong participant và FINANCIAL_INFORMATION_JSON = NULL ở mẫu này không đại diện cấu trúc tài chính v1.4.

Nguồn: **BP-13.1 BPM Disbursement v1.1.docx → Example 1 - Command**. Giá trị lấy trực tiếp từ JSON example sau khi bỏ phần tracked deletion. Bản ghi theo cấu trúc 22 cột hiện tại, chỉ gồm Phase 1.1.

Câu lệnh INSERT đầy đủ, bao gồm nội dung thật của từng cột JSON: [Disbursement_Command_Sample_Insert.sql](Disbursement_Command_Sample_Insert.sql).

### 7.1. Giá trị 11 cột scalar

| Cột DB | Giá trị từ example |
|---|---|
| `DQ_MESSAGE_GUID` | `8ad22d19-b828-40d7-a378-c54aecd6cbab` |
| `CORRELATION_ID` | `8ad22d19-b828-40d7-a378-c54aecd6cbab` |
| `APP_NUMBER` | `3001340` |
| `LEAD_ID` | `4913378` |
| `BRANCH_CODE` | `000` |
| `PRODUCT_SYS_NAME` | `PurchaseNewCar` |
| `OFFERED_LOAN_AMOUNT` | `432333334` |
| `CURRENCY` | `VND` |
| `PRODUCT_TEXT` | `Purchase new car` |
| `APPROVAL_DATE` | `2026-09-30T11:32:19.252Z` |
| `APPROVAL_LEVEL` | `A` |

APPROVAL_DATE được chuyển từ chuỗi 2026-09-30T11:32:19.252Z sang TIMESTAMP WITH TIME ZONE với offset +00:00 trong INSERT.

### 7.2. Dữ liệu 11 cột JSON trong cùng bản ghi

| Cột DB | Nội dung trong bản ghi mẫu |
|---|---|
| `HEADER_JSON` | Object gồm contentType, producer, sender và spring_json_header_types; khai báo kiểu header đã parse thành object. |
| `PAYLOAD_JSON` | Object có 49 property còn lại thực sự xuất hiện trong example; không tự thêm field thiếu. |
| `EXCEPTION_CONDITIONS_JSON` | Array có 1 điều kiện ngoại lệ, reasonException = EXP1_EXCEPTION STANDARD CREDIT RATING. |
| `PARTICIPANTS_JSON` | Array có 1 borrower: CIF = 14877258, fullName = FULL NAME 14877258; documents[0].documentNumber = 148772583. Giữ cả incomeList nằm trong participant theo example. |
| `FINANCIAL_INFORMATION_JSON` | SQL NULL: example không có field financialInformation ở cấp đầu. |
| `ADVANCED_PAYMENT_CONDITIONS_JSON` | Array có 1 phần tử: advancedPaymentCondition = Text. |
| `COLLATERALS_JSON` | Array có 1 tài sản: collateralTypeText = Movable property; giữ owners và legalDocuments. |
| `DOCUMENTS_ATTACHMENT_JSON` | Array có 1 tài liệu: docId = 42344543543545, attachName = File.txt. |
| `SUPPLEMENTAL_INTEREST_RATE_JSON` | Array có 2 chương trình: appStateDataSource = draftContract và disbursementRequest; mỗi chương trình có appInterestRates và earlyRepaymentFees. |
| `DISBURSEMENT_INFORMATION_JSON` | Object có beneficiaryText = TPBank, payeeAccountNumber = 123456789 và payeeName = FULL NAME 00000311. |
| `LOAN_REPAYMENT_INFORMATION_JSON` | Object có repaymentAccountNumber = 03597164444, ngày trả gốc = 14 và ngày trả lãi = 22; giữ các field còn lại. |

Nội dung JSON đầy đủ nằm trong file INSERT, không dùng dấu ... hoặc dữ liệu thay thế.

### 7.3. Những điểm giữ đúng theo example

- Example có disbursementRequest thuộc Phase 1.2: loại riêng nhóm này khỏi bản ghi Phase 1.1. Không loại supplementalInterestRateInformation[].appStateDataSource = disbursementRequest vì đó là giá trị của nhóm lãi suất Phase 1.1.
- Example đặt incomeList trong participants và không có financialInformation cấp đầu: giữ đúng cấu trúc nguồn, không tự chuyển incomeList sang FINANCIAL_INFORMATION_JSON.
- Example thiếu một số property được bảng đặc tả đánh dấu required, như participants[].documents[].documentTypeText, collaterals[].collateralType và disbursementInformation.beneficiary. Bản ghi mẫu không tự điền các giá trị này; nó minh họa lưu example, không khẳng định example đáp ứng toàn bộ validation nghiệp vụ.
- PAYLOAD_JSON có 49 property trong bản ghi này thay vì tối đa 51 property đã liệt kê, do example dùng approvalSysName/approvalName và không gửi approvalDecision/approvalDecisionName.
- spring_json_header_types trong Word là chuỗi chứa JSON: parse thành object trước khi đưa vào HEADER_JSON theo thiết kế hiện tại.
- Chuỗi interestRateDetail có xuống dòng trong Word: khi serialize JSON, dùng escape `\n` để nội dung hợp lệ mà vẫn giữ giá trị chuỗi.
- File SQL chỉ có một INSERT, không tạo bảng, không COMMIT và chưa được thực thi trên DB.


## 8. Phạm vi cập nhật schema/comment theo v1.4

| Thành phần | Cập nhật |
|---|---|
| Cấu trúc vật lý | Giữ 22 cột: 11 scalar và 11 JSON; các datatype CLOB và constraint IS JSON không đổi. |
| PARTICIPANTS_JSON | Bổ sung 8 property mới, mở rộng role = related, ghi rõ required theo role và nguồn tham chiếu. |
| FINANCIAL_INFORMATION_JSON | Đổi schema gốc từ array thành object, dùng incomeList[]/expenseList[], bỏ averageTotalMonthlyIncome và details[] khỏi schema hiện hành. |
| DISBURSEMENT_INFORMATION_JSON | Thêm beneficiaryBankId với type Number, required theo bảng đặc tả v1.4. |
| COLLATERALS_JSON | Ghi nhận collateralCode có thêm giá trị trong example v1.4; property đã có trong schema trước đó. |
| COMMENT SQL | Cập nhật comment bảng và các cột JSON liên quan; vẫn có comment đủ 22 cột. |
| Bản ghi mẫu SQL | Giữ bản v1.1 và ghi rõ phiên bản tại mục 7; chưa viết lại example theo v1.4. |

Hai tài liệu BP13.1_Phase1.1_Field_Matrix.md và BP13.1_Payload_DB_Mapping.md vẫn là phân tích dựa trên v1.1. Các thay đổi schema mới trong tài liệu này lấy từ Word v1.4, không suy ra từ bản matrix cũ.

