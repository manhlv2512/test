# eKYC Report Module

## Mục tiêu

Xây dựng module báo cáo eKYC tương tự module: transactions/block
Chức năng:

- Tra cứu hồ sơ eKYC.
- Xem kết quả xác thực sinh trắc học.
- Đối soát dữ liệu VNeID và QR CCCD.
- Export Excel.
- Danh sách trả đầy đủ dữ liệu, popup chi tiết sử dụng dữ liệu tại dòng được chọn, không gọi API Detail.

---

# Database

## Table

```sql
CREATE TABLE GNCN_EKYC_DOCUMENT (
    ID RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,

    TRANS_ID VARCHAR2(255),
    BRANCH VARCHAR2(50),
    USER_ID VARCHAR2(100),

    REQUEST_DATE DATE,

    CIF VARCHAR2(100),
    ID_CARD VARCHAR2(100),
    CARD_TYPE VARCHAR2(100) DEFAULT 'CCCD',

    FULL_NAME VARCHAR2(255),
    BIRTHDAY DATE,

    PERMANENT_ADDRESS VARCHAR2(1000),
    CURRENT_ADDRESS VARCHAR2(1000),

    GENDER VARCHAR2(20),

    REF_NUM VARCHAR2(100),
    ECM_ID VARCHAR2(100),
    FILE_NAME VARCHAR2(255),

    CUSTOMER_PHOTO CLOB,
    JSON_DATA CLOB,

    CREATED_DATE TIMESTAMP DEFAULT SYSTIMESTAMP
);
```

---

# Object Model

```javascript
var ekycDocument = {
    // ===== Thông tin hệ thống =====
    id: String,
    transId: String,
    branch: String,
    userId: String,

    // ===== Thông tin yêu cầu =====
    requestDate: String,

    // ===== Thông tin khách hàng (nguồn VNeID) =====
    cif: String,
    idCard: String,
    cardType: String,

    fullName: String,
    birthday: String,

    permanentAddress: String,
    currentAddress: String,

    gender: String,

    // ===== Thông tin hồ sơ =====
    refNum: String,
    ecmId: String,
    fileName: String,

    // ===== Kết quả xác thực sinh trắc học =====
    customerPhoto: {
        faceMatchScore: Number,
        livenessScore: Number,
        overallScore: Number,
        isVerified: Number // overallScore > 95 ? 1 : 0
    },

    // ===== Kết quả đối soát QR CCCD và VNeID =====
    jsonData: [
        {
            key: String,
            label: String,
            qrcodeValue: String,
            isCompare: Number
        }
    ],

    // ===== Audit =====
    createdDate: String
};
```

---

# CUSTOMER_PHOTO

Lưu JSON dạng String trong CLOB.

```json
{
  "faceMatchScore": 98.5,
  "livenessScore": 99.2,
  "overallScore": 97.8,
  "isVerified": 1
}
```

Rule:

```javascript
isVerified = overallScore > 95 ? 1 : 0;
```

---

# JSON_DATA

Lưu kết quả đối soát dữ liệu giữa VNeID và QR CCCD.

```json
[
  {
    "key": "fullName",
    "label": "Họ và tên",
    "qrcodeValue": "NGUYEN VAN AN",
    "isCompare": 1
  },
  {
    "key": "birthday",
    "label": "Ngày sinh",
    "qrcodeValue": "1990-01-15",
    "isCompare": 1
  },
  {
    "key": "gender",
    "label": "Giới tính",
    "qrcodeValue": "NAM",
    "isCompare": 1
  },
  {
    "key": "currentAddress",
    "label": "Địa chỉ hiện tại",
    "qrcodeValue": "Ha Noi",
    "isCompare": 0
  }
]
```

---

# API

## Search

```http
POST /api/report/ekyc/search
```

### Request

```json
{
  "page": 1,
  "pageSize": 10,
  "sort": {
    "field": "createdDate",
    "type": "DESC"
  },
  "filters": {
    "keyword": "",
    "branch": "",
    "userId": "",
    "cif": "",
    "idCard": "",
    "isVerified": null,
    "dateFrom": "",
    "dateTo": ""
  }
}
```

### Response

```json
{
  "page": 1,
  "pageSize": 10,
  "totalRecords": 100,
  "data": []
}
```

Response trả đầy đủ object `ekycDocument`.

---

## Export Excel

```http
POST /api/report/ekyc/export
```

Filter sử dụng giống API Search.

---

# Search Conditions

```text
keyword     (TransId, RefNum, CIF, CCCD, Họ tên)
branch
userId
cif
idCard
isVerified
dateFrom
dateTo
```

---

# UI

## Danh sách

Hiển thị các cột:

```text
STT
Mã GD
Chi nhánh
User
Ngày yêu cầu
CIF
CCCD
Họ tên
Kết quả STH
Tỷ lệ khớp
Ngày tạo
Chi tiết
```

### Mapping

```text
Mã GD          -> transId
Chi nhánh      -> branch
User           -> userId
Ngày yêu cầu   -> requestDate
CIF            -> cif
CCCD           -> idCard
Họ tên         -> fullName
Kết quả STH    -> customerPhoto.isVerified
Tỷ lệ khớp     -> customerPhoto.overallScore
Ngày tạo       -> createdDate
```

---

## Popup Chi Tiết

Click icon/button "Chi tiết".

Không gọi API Detail.

Dữ liệu sử dụng trực tiếp từ row được chọn:

```javascript
openDetailPopup(selectedRow);
```

### Thông tin khách hàng

```text
CIF
CCCD
Loại giấy tờ
Họ tên
Ngày sinh
Giới tính
Địa chỉ thường trú
Địa chỉ hiện tại
```

### Kết quả xác thực sinh trắc học

```text
Face Match Score
Liveness Score
Overall Score
Kết quả xác thực
```

### Bảng đối soát VNeID - QR CCCD

```text
Trường dữ liệu
Giá trị VNeID
Giá trị QR CCCD
Kết quả
```

Build động từ:

```javascript
jsonData
```

Giá trị VNeID lấy theo:

```javascript
selectedRow[item.key]
```

---

# Export Excel

Tên sheet:

```text
EKYC_REPORT
```

Các cột export:

```text
Mã GD
Chi nhánh
User
Ngày yêu cầu
CIF
CCCD
Họ tên
Ngày sinh
Giới tính
Kết quả xác thực
Tỷ lệ khớp
Ngày tạo
```

---

# Service

```java
search(SearchRequest request)

export(SearchRequest request)
```

---

# Repository

```java
search()

count()

exportData()
```

---

# Permission

```text
REPORT_EKYC_VIEW
REPORT_EKYC_EXPORT
```

---

# Logging

Ghi log các thao tác:

```text
Search eKYC Report
Export eKYC Report
```

Bao gồm:

```text
username
branch
request time
execution time
total records
```

---

# Sample Dataset

```json
{
  "id": "A34F8CBA90DE4E3AB52C4A1F12345678",
  "transId": "EKYC202610250001",
  "branch": "001",
  "userId": "manhlv1",

  "requestDate": "2026-10-25",

  "cif": "100000001",
  "idCard": "001201001234",
  "cardType": "CCCD",

  "fullName": "NGUYEN VAN AN",
  "birthday": "1990-01-15",

  "permanentAddress": "Ba Dinh, Ha Noi",
  "currentAddress": "Cau Giay, Ha Noi",

  "gender": "NAM",

  "refNum": "REF202610250001",
  "ecmId": "ECM000001",
  "fileName": "001201001234.pdf",

  "customerPhoto": {
    "faceMatchScore": 99.2,
    "livenessScore": 98.8,
    "overallScore": 98.9,
    "isVerified": 1
  },

  "jsonData": [
    {
      "key": "fullName",
      "label": "Họ và tên",
      "qrcodeValue": "NGUYEN VAN AN",
      "isCompare": 1
    },
    {
      "key": "birthday",
      "label": "Ngày sinh",
      "qrcodeValue": "1990-01-15",
      "isCompare": 1
    },
    {
      "key": "gender",
      "label": "Giới tính",
      "qrcodeValue": "NAM",
      "isCompare": 1
    }
  ],

  "createdDate": "2026-10-25 09:15:32"
}
```

### Yêu cầu sinh dữ liệu mẫu

```text
50 records

70% isVerified = 1
30% isVerified = 0

Ít nhất 5 chi nhánh
Ít nhất 5 user

Dữ liệu trong 30 ngày gần nhất

Mỗi record có từ 3-8 dòng jsonData

80% isCompare = 1
20% isCompare = 0
```