CREATE OR REPLACE PROCEDURE SP_GET_DISB_TRANSACTION_PAGING (
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
    V_FLOW              VARCHAR2(200);   -- flow: phân luồng
    V_PROCESS_GROUP     VARCHAR2(200);   -- processGroup: nhóm xử lý
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
    C_FINISHED_STATUS CONSTANT VARCHAR2(100) := ',GNCN_HUY,GNCN_HOAN_THANH,';

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
     *     "status": "GNCN_KHOI_TAO,GNCN_HACH_TOAN",
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
            V_FLOW := TRIM(V_FILTERS_OBJ.GET_STRING('flow'));
            V_PROCESS_GROUP := TRIM(V_FILTERS_OBJ.GET_STRING('processGroup'));
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
    IF V_SORT_FIELD IS NULL OR V_SORT_FIELD NOT IN ('createdDate', 'taskStartTime', '_sla') THEN
      V_SORT_FIELD := 'createdDate';
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
      FROM GNCN_TRANSACTION GT
    WHERE 
      1 = 1
      AND (
        V_KEYWORD IS NULL
        OR GT.GNTD_CODE LIKE '%' || UPPER(V_KEYWORD) || '%'
        OR GT.PDTD_CODE LIKE '%' || UPPER(V_KEYWORD) || '%'
        OR GT.CUSTOMER_CODE LIKE '%' || UPPER(V_KEYWORD) || '%'
        OR UPPER(GT.CUSTOMER_NAME) LIKE '%' || UPPER(V_KEYWORD) || '%'
        OR UPPER(GT.PROCESSING_OWNER) LIKE '%' || UPPER(V_KEYWORD) || '%'
      )
      -- Bọc dấu phẩy hai đầu để "01" không khớp nhầm "001"
      AND (V_BRANCH IS NULL OR INSTR(',' || V_BRANCH || ',', ',' || GT.BRANCH_CODE || ',') > 0)
      AND (V_FLOW IS NULL OR GT.TRANSACTION_FLOW = V_FLOW)
      AND (V_PROCESS_GROUP IS NULL OR GT.PROCESS_GROUP = V_PROCESS_GROUP)
      AND (V_TRANSACTION_TYPE1 IS NULL OR GT.TRANSACTION_TYPE1 = V_TRANSACTION_TYPE1)
      AND (V_STATUS IS NULL OR INSTR(',' || V_STATUS || ',', ',' || GT.STATUS || ',') > 0)
      AND (V_HIDE_FINISHED = 0 OR INSTR(C_FINISHED_STATUS, ',' || GT.STATUS || ',') = 0)
      -- Thời điểm: ngày chuyển chờ xử lý, chưa chuyển thì lấy ngày tạo
      AND (V_DATE_FROM IS NULL OR NVL(GT.PROCESSING_DATE, GT.CREATED_DATE) >= V_DATE_FROM)
      AND (V_DATE_TO IS NULL OR NVL(GT.PROCESSING_DATE, GT.CREATED_DATE) < V_DATE_TO);

    OPEN OUT_DATA FOR
      SELECT
        GT.ID,
        GT.STATUS,
        S.NAME AS STATUS_NAME,                                          -- statusName
        GT.GNTD_CODE,
        GT.PDTD_CODE,
        GT.BRANCH_CODE,
        GT.BRANCH_NAME,
        GT.TRANSACTION_FLOW,
        C.NAME AS TRANSACTION_FLOW_NAME,                                -- transactionFlowName
        GT.TRANSACTION_TYPE1,
        T.NAME AS TRANSACTION_TYPE1_NAME,                               -- transactionType1Name
        GT.TRANSACTION_TYPE2,
        GT.TRANSACTION_TYPE3,
        GT.ID_CARD,
        GT.CUSTOMER_CODE,
        GT.CUSTOMER_NAME,
        GT.CUSTOMER_TYPE,
        GT.PRODUCT_CODE,
        GT.PRODUCT_NAME,
        GT.USE_PDTD,
        GT.CURRENCY,
        GT.PROCESSING_OWNER AS PROCESS_USER,                            -- processUser: User xử lý (khởi tạo, chuyển phê duyệt)
        GT.APPROVER_SUGGEST AS ASSIGN_USER,                             -- assignUser: User phân công (gợi ý xử lý)
        GT.PROCESSING_USER,
        GT.USER_LOCKED AS LOCK_USER,                                    -- lockUser
        GT.PROCESS_GROUP,                    -- Nhóm xử lý
        TO_CHAR(GT.PROCESSING_DATE, C_DATETIME_FORMAT) AS PROCESSING_DATE,
        TO_CHAR(NVL(GT.PROCESSING_DATE, GT.CREATED_DATE), C_DATETIME_FORMAT) AS TASK_START_TIME,
        GT.APPROVAL_BY,
        TO_CHAR(GT.APPROVAL_DATE, C_DATETIME_FORMAT) AS APPROVAL_DATE,
        GT.DESCRIPTION,
        GT.CREATED_BY,
        TO_CHAR(GT.CREATED_DATE, C_DATETIME_FORMAT) AS CREATED_AT,     -- createdAt: Thời điểm tiếp nhận
        GT.MODIFIED_BY,
        TO_CHAR(GT.MODIFIED_DATE, C_DATETIME_FORMAT) AS MODIFIED_AT,
        TO_CHAR(GT.YELLOW_FLAG_DATE, C_DATETIME_FORMAT) AS YELLOW_FLAG_DATE,  -- Cảnh báo SLA
        TO_CHAR(GT.RED_FLAG_DATE, C_DATETIME_FORMAT) AS RED_FLAG_DATE         -- Hạn SLA
      FROM GNCN_TRANSACTION GT
      LEFT JOIN (
        SELECT * FROM GNCN_TRANSACTION_TYPE WHERE LEVEL_TYPE = 1 AND USE_STATUS = 1
      ) T ON T.CODE = GT.TRANSACTION_TYPE1
      LEFT JOIN (
        SELECT * FROM GNCN_STATUS WHERE 1 = 1
      ) S ON S.CODE = GT.STATUS
      LEFT JOIN (
        SELECT * FROM GNCN_CONFIG_COMMONS WHERE SCOPE = 'TRAN_FLOW'
      ) C ON C.CODE = GT.TRANSACTION_FLOW
      WHERE
        (
          V_KEYWORD IS NULL
          OR UPPER(GT.GNTD_CODE) LIKE '%' || UPPER(V_KEYWORD) || '%'
          OR UPPER(GT.PDTD_CODE) LIKE '%' || UPPER(V_KEYWORD) || '%'
          OR UPPER(GT.CUSTOMER_CODE) LIKE '%' || UPPER(V_KEYWORD) || '%'
          OR UPPER(GT.CUSTOMER_NAME) LIKE '%' || UPPER(V_KEYWORD) || '%'
          OR UPPER(GT.PROCESSING_OWNER) LIKE '%' || UPPER(V_KEYWORD) || '%'
        )
        AND (V_BRANCH IS NULL OR INSTR(',' || V_BRANCH || ',', ',' || GT.BRANCH_CODE || ',') > 0)
        AND (V_FLOW IS NULL OR GT.TRANSACTION_FLOW = V_FLOW)
        AND (V_PROCESS_GROUP IS NULL OR GT.PROCESS_GROUP = V_PROCESS_GROUP)
        AND (V_TRANSACTION_TYPE1 IS NULL OR GT.TRANSACTION_TYPE1 = V_TRANSACTION_TYPE1)
        AND (V_STATUS IS NULL OR INSTR(',' || V_STATUS || ',', ',' || GT.STATUS || ',') > 0)
        AND (V_HIDE_FINISHED = 0 OR INSTR(C_FINISHED_STATUS, ',' || GT.STATUS || ',') = 0)
        AND (V_DATE_FROM IS NULL OR NVL(GT.PROCESSING_DATE, GT.CREATED_DATE) >= V_DATE_FROM)
        AND (V_DATE_TO IS NULL OR NVL(GT.PROCESSING_DATE, GT.CREATED_DATE) < V_DATE_TO)
      
      ORDER BY
        -- Thời điểm tiếp nhận
        CASE WHEN V_SORT_FIELD = 'taskStartTime' AND V_SORT_TYPE = 'ASC'  THEN NVL(GT.PROCESSING_DATE, GT.CREATED_DATE) END ASC,
        CASE WHEN V_SORT_FIELD = 'taskStartTime' AND V_SORT_TYPE = 'DESC' THEN NVL(GT.PROCESSING_DATE, GT.CREATED_DATE) END DESC,
        -- Thời gian khởi tạo
        CASE WHEN V_SORT_FIELD = 'createdDate' AND V_SORT_TYPE = 'ASC' THEN GT.CREATED_DATE END ASC,
        CASE WHEN V_SORT_FIELD = 'createdDate' AND V_SORT_TYPE = 'DESC' THEN GT.CREATED_DATE END DESC,
        GT.CREATED_DATE DESC,
        -- Khoá phụ để thứ tự ổn định giữa các trang khi trùng thời điểm
        GT.ID DESC
      
      OFFSET V_OFFSET_ROWS ROWS
      FETCH NEXT V_PAGE_SIZE ROWS ONLY;

END SP_GET_DISB_TRANSACTION_PAGING;