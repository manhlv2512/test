CREATE OR REPLACE PROCEDURE SP_GET_GNCN_TRANSACTION_BLOCK_ACCOUNT (
    P_JSON_OBJECT IN CLOB,
    P_TOTAL       OUT NUMBER,
    OUT_DATA      OUT SYS_REFCURSOR
)
AS
    V_JSON_OBJ       JSON_OBJECT_T;
    V_FILTERS_OBJ    JSON_OBJECT_T;
    V_PAGE           NUMBER := 1;
    V_PAGE_SIZE      NUMBER := 10;
    V_OFFSET_ROWS    NUMBER;
    V_KEYWORD        VARCHAR2(4000);
    V_BRANCH         VARCHAR2(200);
    V_FLOW           VARCHAR2(200);
    V_DATE_FROM_TEXT VARCHAR2(50);
    V_DATE_TO_TEXT   VARCHAR2(50);
    V_DATE_FROM      DATE;
    V_DATE_TO        DATE;
    V_STATE          VARCHAR2(200);
    C_DATE_FORMAT CONSTANT VARCHAR2(10) := 'YYYY-MM-DD';
BEGIN
    /*
     * Expected request:
     * {
     *   "page": 1,
     *   "pageSize": 10,
     *   "sort": { "field": null, "type": null },
     *   "filters": {
     *     "keyword": "xxx",
     *     "branch": "001",
     *     "flow": "GD_DVKD",
     *     "date_from": "2026-10-14",
     *     "date_to": "2026-10-14"
     *   }
     * }
     */
    IF P_JSON_OBJECT IS NOT NULL THEN
        V_JSON_OBJ := JSON_OBJECT_T.PARSE(P_JSON_OBJECT);

        V_PAGE := NVL(V_JSON_OBJ.GET_NUMBER('page'), 1);
        V_PAGE_SIZE := NVL(V_JSON_OBJ.GET_NUMBER('pageSize'), 10);

        IF V_JSON_OBJ.HAS('filters') THEN
            V_FILTERS_OBJ := V_JSON_OBJ.GET_OBJECT('filters');
        END IF;

        IF V_FILTERS_OBJ IS NOT NULL THEN
            V_KEYWORD := TRIM(V_FILTERS_OBJ.GET_STRING('keyword'));
            V_BRANCH := TRIM(V_FILTERS_OBJ.GET_STRING('branch'));
            V_FLOW := TRIM(V_FILTERS_OBJ.GET_STRING('flow'));
            V_DATE_FROM_TEXT := TRIM(V_FILTERS_OBJ.GET_STRING('date_from'));
            V_DATE_TO_TEXT := TRIM(V_FILTERS_OBJ.GET_STRING('date_to'));
            V_STATE := TRIM(V_FILTERS_OBJ.GET_STRING('state'));
        END IF;
    END IF;

    -- Normalize pagination after reading JSON values.
    V_PAGE := GREATEST(NVL(TRUNC(V_PAGE), 1), 1);
    V_PAGE_SIZE := GREATEST(NVL(TRUNC(V_PAGE_SIZE), 10), 1);
    V_OFFSET_ROWS := (V_PAGE - 1) * V_PAGE_SIZE;

    IF V_DATE_FROM_TEXT IS NOT NULL THEN
        V_DATE_FROM := TO_DATE(V_DATE_FROM_TEXT, C_DATE_FORMAT);
    END IF;

    IF V_DATE_TO_TEXT IS NOT NULL THEN
        V_DATE_TO := TO_DATE(V_DATE_TO_TEXT, C_DATE_FORMAT) + 1;
    END IF;

    -- Count the complete filtered result before applying pagination.
    SELECT COUNT(1)
      INTO P_TOTAL
      FROM GNCN_TRANSACTION_RELEASE_AMT_BLOCK A
     WHERE (
               V_KEYWORD IS NULL
               OR UPPER(A.GNTD_CODE) LIKE '%' || UPPER(V_KEYWORD) || '%'
               OR UPPER(A.PDTD_CODE) LIKE '%' || UPPER(V_KEYWORD) || '%'
               OR UPPER(A.CUSTOMER_CODE) LIKE '%' || UPPER(V_KEYWORD) || '%'
               OR UPPER(A.CUSTOMER_NAME) LIKE '%' || UPPER(V_KEYWORD) || '%'
               OR UPPER(A.ACC_BLOCK_NO) LIKE '%' || UPPER(V_KEYWORD) || '%'
           )
       AND (V_BRANCH IS NULL OR A.BRANCH_CODE = V_BRANCH)
       AND (V_FLOW IS NULL OR A.TRANSACTION_FLOW = V_FLOW)
       AND (V_DATE_FROM IS NULL OR A.CREATED_DATE >= V_DATE_FROM)
       AND (V_DATE_TO IS NULL OR A.CREATED_DATE < V_DATE_TO);

    -- Preserve the existing output columns and lookup joins.
    OPEN OUT_DATA FOR
        SELECT
            A.GNTD_CODE,
            A.PROCESS_STATE AS STATE,
            A.STATUS,
            A.ACC_BLOCK_NO,
            A.BRANCH_CODE,
            A.PDTD_CODE,
            A.CUSTOMER_CODE,
            A.CUSTOMER_NAME,
            (A.CUSTOMER_CODE || '<br/>' || A.CUSTOMER_NAME) AS CUSTOMERDISPLAY,
            A.LIMIT_CODE,
            A.CURRENCY,
            A.TRANSACTION_FLOW,
            A.TRANSACTION_TYPE1,
            C.NAME AS TRANSACTIONFLOWNAME,
            T.NAME AS TRANSACTIONTYPE1NAME,
            TO_CHAR(A.GN_APPROVAL_DATE, C_DATE_FORMAT) AS GN_APPROVAL_DATE,
            CASE
              WHEN A.PROCESS_STATE = 1 THEN 'Đã xử lý'
              ELSE 'Chưa xử lý'
            END AS STATE_NAME,
            A.GN_APPROVAL_BY
        FROM GNCN_TRANSACTION_RELEASE_AMT_BLOCK A
        LEFT JOIN (
            SELECT *
              FROM GNCN_TRANSACTION_TYPE
             WHERE LEVEL_TYPE = 1
               AND USE_STATUS = 1
        ) T
          ON T.CODE = A.TRANSACTION_TYPE1
        LEFT JOIN (
            SELECT *
              FROM GNCN_CONFIG_COMMONS
             WHERE SCOPE = 'TRAN_FLOW'
        ) C
          ON C.CODE = A.TRANSACTION_FLOW
        WHERE 
          (
            V_KEYWORD IS NULL
            OR UPPER(A.GNTD_CODE) LIKE '%' || UPPER(V_KEYWORD) || '%'
            OR UPPER(A.PDTD_CODE) LIKE '%' || UPPER(V_KEYWORD) || '%'
            OR UPPER(A.CUSTOMER_CODE) LIKE '%' || UPPER(V_KEYWORD) || '%'
            OR UPPER(A.CUSTOMER_NAME) LIKE '%' || UPPER(V_KEYWORD) || '%'
            OR UPPER(A.ACC_BLOCK_NO) LIKE '%' || UPPER(V_KEYWORD) || '%'
          )
          AND (V_BRANCH IS NULL OR A.BRANCH_CODE = V_BRANCH)
          AND (V_FLOW IS NULL OR A.TRANSACTION_FLOW = V_FLOW)
          AND (V_STATE IS NULL OR A.PROCESS_STATE = TO_NUMBER(V_STATE))
          AND (V_DATE_FROM IS NULL OR A.CREATED_DATE >= V_DATE_FROM)
          AND (V_DATE_TO IS NULL OR A.CREATED_DATE < V_DATE_TO)
        ORDER BY A.CREATED_DATE DESC, A.GNTD_CODE DESC
        OFFSET V_OFFSET_ROWS ROWS
        FETCH NEXT V_PAGE_SIZE ROWS ONLY;
END SP_GET_GNCN_TRANSACTION_BLOCK_ACCOUNT;
/
