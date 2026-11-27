create or replace PROCEDURE SP_GET_HK_TRANSACTION_PAGING (
    P_JSON_OBJECT IN CLOB,
    P_TOTAL       OUT NUMBER,
    OUT_DATA      OUT SYS_REFCURSOR
)
AS
    V_JSON_OBJ          JSON_OBJECT_T;
    V_FILTERS_OBJ       JSON_OBJECT_T;
    V_SORT_OBJ          JSON_OBJECT_T;
    V_PAGE              NUMBER := 1;
    V_PAGE_SIZE         NUMBER := 10;
    V_OFFSET_ROWS       NUMBER;
    V_SORT_FIELD        VARCHAR2(50);
    V_SORT_TYPE         VARCHAR2(4);
    -- Filters (theo searchFields trong transactions/disb/table-config.json)
    V_KEYWORD           VARCHAR2(4000);  -- keyword: Mã GNTD, mã PDTD, mã/tên KH, user xử lý
    V_BRANCH            VARCHAR2(4000);  -- branch: "000" | "000,001,100" | null (null = không lọc ĐVKD)
    V_TRANSACTION_TYPE1 VARCHAR2(200);   -- transactionType1: loại giao dịch cấp 1
    V_STATUS            VARCHAR2(4000);  -- status: multi-select, joinWith ","
    V_DATE_FROM_TEXT    VARCHAR2(50);    -- date_from (daterange "date")
    V_DATE_TO_TEXT      VARCHAR2(50);    -- date_to   (daterange "date")
    V_DATE_FROM         DATE;
    V_DATE_TO           DATE;
    -- Không lọc trạng thái và không có từ khoá thì ẩn hồ sơ đã kết thúc (giữ logic cũ)
    V_HIDE_FINISHED     NUMBER := 0;
    C_DATE_FORMAT     CONSTANT VARCHAR2(10) := 'YYYY-MM-DD';
    C_DATETIME_FORMAT CONSTANT VARCHAR2(21) := 'YYYY-MM-DD HH24:MI:SS';
    C_FINISHED_STATUS CONSTANT VARCHAR2(100) := ',HOAN_THANH,';

BEGIN
    /*
     * Expected request:
     * {
     *   "page": 1,
     *   "pageSize": 10,
     *   "sort": { "field": "createdDate" | "_sla", "type": "ASC" | "DESC" },
     *   "filters": {
     *     "keyword": "GNCN441",
     *     "branch": "000" | "000,001,100" | null,
     *     "flow": "TT",
     *     "processGroup": "RB.TINH",
     *     "transactionType1": "Giaingankhoanvay",
     *     "status": "HOAN_THANH,CHUA_HAU_KIEM",
     *     "date_from": "2026-10-07",
     *     "date_to": "2026-11-07"
     *   }
     * }
     */
    IF P_JSON_OBJECT IS NOT NULL THEN
        V_JSON_OBJ := JSON_OBJECT_T.PARSE(P_JSON_OBJECT);

        V_PAGE := NVL(V_JSON_OBJ.GET_NUMBER('page'), 1);
        V_PAGE_SIZE := NVL(V_JSON_OBJ.GET_NUMBER('pageSize'), 10);

        IF V_JSON_OBJ.HAS('sort') AND V_JSON_OBJ.GET('sort').IS_OBJECT THEN
            V_SORT_OBJ := V_JSON_OBJ.GET_OBJECT('sort');
            V_SORT_FIELD := TRIM(V_SORT_OBJ.GET_STRING('field'));
            V_SORT_TYPE := UPPER(TRIM(V_SORT_OBJ.GET_STRING('type')));
        END IF;

        IF V_JSON_OBJ.HAS('filters') AND V_JSON_OBJ.GET('filters').IS_OBJECT THEN
            V_FILTERS_OBJ := V_JSON_OBJ.GET_OBJECT('filters');
        END IF;

        IF V_FILTERS_OBJ IS NOT NULL THEN
            V_KEYWORD := TRIM(V_FILTERS_OBJ.GET_STRING('keyword'));
            -- Bỏ khoảng trắng: "000, 001" -> "000,001"; chuỗi rỗng thành NULL
            V_BRANCH := REPLACE(TRIM(V_FILTERS_OBJ.GET_STRING('branch')), ' ', '');
            V_TRANSACTION_TYPE1 := TRIM(V_FILTERS_OBJ.GET_STRING('transactionType1'));
            V_STATUS := TRIM(V_FILTERS_OBJ.GET_STRING('status'));
            V_DATE_FROM_TEXT := TRIM(V_FILTERS_OBJ.GET_STRING('date_from'));
            V_DATE_TO_TEXT := TRIM(V_FILTERS_OBJ.GET_STRING('date_to'));
        END IF;
    END IF;

    -- Normalize pagination after reading JSON values.
    V_PAGE := GREATEST(NVL(TRUNC(V_PAGE), 1), 1);
    V_PAGE_SIZE := GREATEST(NVL(TRUNC(V_PAGE_SIZE), 10), 1);
    V_OFFSET_ROWS := (V_PAGE - 1) * V_PAGE_SIZE;

    -- Chỉ cho phép sort theo mốc thời gian; giá trị khác về mặc định createdDate DESC.
    IF V_SORT_FIELD IS NULL OR V_SORT_FIELD NOT IN ('paExpiryDate', 'taskStartTime') THEN
      V_SORT_FIELD := 'taskStartTime';
    END IF;
    IF V_SORT_TYPE IS NULL OR V_SORT_TYPE NOT IN ('ASC', 'DESC') THEN
      V_SORT_TYPE := 'DESC';
    END IF;

    IF V_DATE_FROM_TEXT IS NOT NULL THEN
      V_DATE_FROM := TO_DATE(V_DATE_FROM_TEXT, C_DATE_FORMAT);
    END IF;

    IF V_DATE_TO_TEXT IS NOT NULL THEN
      V_DATE_TO := TO_DATE(V_DATE_TO_TEXT, C_DATE_FORMAT) + 1;
    END IF;

    IF V_STATUS IS NULL AND V_KEYWORD IS NULL THEN
      V_HIDE_FINISHED := 1;
    END IF;

    -- Count the complete filtered result before applying pagination.
    SELECT COUNT(1)
      INTO P_TOTAL
      FROM HKCN_TRANSACTION
    WHERE 
      1 = 1
      AND (
          V_KEYWORD IS NULL
          OR UPPER(GNTD_CODE) LIKE '%' || UPPER(V_KEYWORD) || '%'
          OR UPPER(PDTD_CODE) LIKE '%' || UPPER(V_KEYWORD) || '%'
          OR UPPER(CUSTOMER_CODE) LIKE '%' || UPPER(V_KEYWORD) || '%'
          OR UPPER(CUSTOMER_NAME) LIKE '%' || UPPER(V_KEYWORD) || '%'
          OR UPPER(USER_ASSIGN) LIKE '%' || UPPER(V_KEYWORD) || '%'
        )
        AND (V_BRANCH IS NULL OR INSTR(',' || V_BRANCH || ',', ',' || BRANCH_CODE || ',') > 0)
        AND (V_TRANSACTION_TYPE1 IS NULL OR TRANS_LEVEL_CODE_1 = V_TRANSACTION_TYPE1)
        AND (V_STATUS IS NULL OR INSTR(',' || V_STATUS || ',', ',' || PA_STATUS || ',') > 0)
        AND (V_HIDE_FINISHED = 0 OR INSTR(C_FINISHED_STATUS, ',' || PA_STATUS || ',') = 0)
        AND (V_DATE_FROM IS NULL OR NVL(PA_EXPIRY_DATE, CREATED_DATE) >= V_DATE_FROM)
        AND (V_DATE_TO IS NULL OR NVL(PA_EXPIRY_DATE, CREATED_DATE) < V_DATE_TO);

    OPEN OUT_DATA FOR
      SELECT
        ID,
        PA_STATUS AS STATUS,
        GNTD_CODE,
        PDTD_CODE,
        BRANCH_CODE,
        TRANSACTION_FLOW,
        TRANS_LEVEL_CODE_1 AS TRANSACTION_TYPE1,
        TRANSACTION_TYPE2,
        TRANSACTION_TYPE3,
        CUSTOMER_CODE,
        CUSTOMER_NAME,
        AMOUNT,
        'VND' AS CURRENCY,
        USER_PA AS PROCESS_USER, -- User xử lý 
        USER_ASSIGN AS ASSIGN_USER, -- User phân công
        GROUP_PROCESS,                    -- Nhóm xử lý
        TO_CHAR(PA_EXPIRY_DATE, C_DATE_FORMAT) AS PA_EXPIRY_DATE,
        GN_APPROVAL_BY,
        TO_CHAR(GN_APPROVAL_DATE, C_DATETIME_FORMAT) AS GN_APPROVAL_DATE,
        TO_CHAR(CREATED_DATE, C_DATETIME_FORMAT) AS CREATED_AT,
        UPDATED_BY,
        TO_CHAR(UPDATED_DATE, C_DATETIME_FORMAT) AS MODIFIED_AT,
        TO_CHAR(NVL(SUBMIT_DATE, CREATED_DATE), C_DATETIME_FORMAT) AS TASK_START_TIME  -- Cảnh báo SLA
      FROM HKCN_TRANSACTION
      WHERE
        (
          V_KEYWORD IS NULL
          OR UPPER(GNTD_CODE) LIKE '%' || UPPER(V_KEYWORD) || '%'
          OR UPPER(PDTD_CODE) LIKE '%' || UPPER(V_KEYWORD) || '%'
          OR UPPER(CUSTOMER_CODE) LIKE '%' || UPPER(V_KEYWORD) || '%'
          OR UPPER(CUSTOMER_NAME) LIKE '%' || UPPER(V_KEYWORD) || '%'
          OR UPPER(USER_ASSIGN) LIKE '%' || UPPER(V_KEYWORD) || '%'
        )
        AND (V_BRANCH IS NULL OR INSTR(',' || V_BRANCH || ',', ',' || BRANCH_CODE || ',') > 0)
        AND (V_TRANSACTION_TYPE1 IS NULL OR TRANS_LEVEL_CODE_1 = V_TRANSACTION_TYPE1)
        AND (V_STATUS IS NULL OR INSTR(',' || V_STATUS || ',', ',' || PA_STATUS || ',') > 0)
        AND (V_HIDE_FINISHED = 0 OR INSTR(C_FINISHED_STATUS, ',' || PA_STATUS || ',') = 0)
        AND (V_DATE_FROM IS NULL OR NVL(PA_EXPIRY_DATE, CREATED_DATE) >= V_DATE_FROM)
        AND (V_DATE_TO IS NULL OR NVL(PA_EXPIRY_DATE, CREATED_DATE) < V_DATE_TO)

      ORDER BY
        -- Thời điểm tiếp nhận
        CASE WHEN V_SORT_FIELD = 'taskStartTime' AND V_SORT_TYPE = 'ASC'  THEN NVL(SUBMIT_DATE, CREATED_DATE) END ASC,
        CASE WHEN V_SORT_FIELD = 'taskStartTime' AND V_SORT_TYPE = 'DESC' THEN NVL(SUBMIT_DATE, CREATED_DATE) END DESC,
        -- Thời gian khởi tạo
        CASE WHEN V_SORT_FIELD = 'paExpiryDate' AND V_SORT_TYPE = 'ASC' THEN PA_EXPIRY_DATE END ASC,
        CASE WHEN V_SORT_FIELD = 'paExpiryDate' AND V_SORT_TYPE = 'DESC' THEN PA_EXPIRY_DATE END DESC,
        CREATED_DATE DESC,
        -- Khoá phụ để thứ tự ổn định giữa các trang khi trùng thời điểm
        ID DESC

      OFFSET V_OFFSET_ROWS ROWS
      FETCH NEXT V_PAGE_SIZE ROWS ONLY;

END SP_GET_HK_TRANSACTION_PAGING;