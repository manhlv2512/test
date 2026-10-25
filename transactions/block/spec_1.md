# Update Stored Procedure: SP_GET_GNCN_TRANSACTION_BLOCK_ACCOUNT

## Mục tiêu

Cập nhật SP `SP_GET_GNCN_TRANSACTION_BLOCK_ACCOUNT` để hỗ trợ:

- Phân trang (pagination)
- Trả về tổng số bản ghi (total)
- Tìm kiếm theo từ khóa
- Filter theo chi nhánh
- Filter theo luồng nghiệp vụ
- Filter theo ngày giao dịch

## Input Request

```json
{
  "page": 1,
  "pageSize": 10,
  "sort": {
    "field": null,
    "type": null
  },
  "filters": {
    "keyword": "xxx",
    "branch": "001",
    "flow": "GD_DVKD",
    "date_from": "2026-10-14",
    "date_to": "2026-10-14"
  }
}
```

## Mapping Input

| Field | Description |
|---------|---------|
| page | Trang hiện tại |
| pageSize | Số bản ghi trên mỗi trang |
| filters.keyword | Từ khóa tìm kiếm |
| filters.branch | Mã chi nhánh |
| filters.flow | Luồng xử lý |
| filters.date_from | Ngày giao dịch từ (bao gồm ngày này) |
| filters.date_to | Ngày giao dịch đến (bao gồm ngày này) |

## Yêu cầu xử lý

### 1. Keyword Search

Tìm kiếm không phân biệt hoa thường trên các cột nghiệp vụ chính:

Ví dụ:

```sql
UPPER(CUSTOMER_NAME) LIKE '%' || UPPER(:keyword) || '%'
OR UPPER(CIF) LIKE '%' || UPPER(:keyword) || '%'
OR UPPER(ACCOUNT_NO) LIKE '%' || UPPER(:keyword) || '%'
OR UPPER(REF_NO) LIKE '%' || UPPER(:keyword) || '%'
```

### 2. Branch Filter

Chỉ áp dụng khi:

```sql
P_BRANCH IS NOT NULL
```

Điều kiện:

```sql
BRANCH_CODE = P_BRANCH
```

### 3. Flow Filter

Chỉ áp dụng khi:

```sql
P_FLOW IS NOT NULL
```

Điều kiện:

```sql
FLOW_CODE = P_FLOW
```

### 4. Date Filter

Filter ngày bắt đầu chỉ áp dụng khi:

```sql
V_DATE_FROM IS NOT NULL
```

Điều kiện:

```sql
CREATED_DATE >= V_DATE_FROM
```

Filter ngày kết thúc chỉ áp dụng khi:

```sql
V_DATE_TO IS NOT NULL
```

Điều kiện dùng khoảng nửa mở để bao gồm toàn bộ thời gian trong ngày `date_to`.
Do `TO_DATE(value, 'YYYY-MM-DD')` trả về thời điểm `00:00:00`, procedure cộng một
ngày ngay khi parse để `V_DATE_TO` trở thành mốc exclusive của ngày kế tiếp:

```sql
V_DATE_TO := TO_DATE(V_DATE_TO_TEXT, C_DATE_FORMAT) + 1;
```

Các query chỉ cần áp dụng:

```sql
CREATED_DATE < V_DATE_TO
```

## Pagination

Tính offset:

```sql
OFFSET_ROWS = (P_PAGE - 1) * P_PAGE_SIZE
```

Áp dụng:

```sql
OFFSET OFFSET_ROWS ROWS
FETCH NEXT P_PAGE_SIZE ROWS ONLY
```

## Output

SP trả về 2 result set:

### Result Set 1: Total

```json
{
  "total": 125
}
```

SQL:

```sql
SELECT COUNT(1) TOTAL
FROM ...
WHERE ...
```

### Result Set 2: Data List

```json
{
  "lists": [
    {
      "id": 1,
      "refNo": "REF001",
      "accountNo": "123456789",
      "customerName": "Nguyen Van A",
      "branch": "001",
      "flow": "GD_DVKD",
      "createdDate": "2026-10-14"
    }
  ]
}
```

## Required Procedure Parameters

Giữ request ở dạng JSON CLOB để có thể bổ sung filter/config mà không phải thay đổi
signature procedure cho mỗi field mới:

```sql
P_JSON_OBJECT IN CLOB,
P_TOTAL       OUT NUMBER,
OUT_DATA      OUT SYS_REFCURSOR
```

Procedure parse `page`, `pageSize` và object `filters` từ `P_JSON_OBJECT`, bao gồm
`date_from` và `date_to` theo định dạng `YYYY-MM-DD`. Format ngày được khai báo
một lần bằng hằng `C_DATE_FORMAT`. `P_TOTAL` là scalar total; `OUT_DATA` là result
set danh sách đã phân trang.

## Expected Response Structure

```json
{
  "total": 125,
  "lists": [
    {
      "...": "..."
    }
  ]
}
```

## Implementation Notes

- Không thay đổi logic nghiệp vụ hiện tại.
- Chỉ bổ sung điều kiện filter động.
- Thực hiện COUNT riêng để lấy total.
- Áp dụng pagination ở bước cuối cùng.
- Giữ nguyên toàn bộ cấu trúc dữ liệu đang trả về.
- Không hard-code giá trị branch hoặc flow.
- Kiểm tra null trước khi thêm điều kiện filter.
- Ưu tiên bind variable để tránh SQL Injection.