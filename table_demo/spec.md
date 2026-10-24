# Table Renderer ES5 Requirement

## Mục tiêu

Xây dựng một component render table bằng JavaScript ES5, không sử dụng framework
(React/Vue/Angular) và không phụ thuộc DataTable jQuery. Search field kiểu `select`
được enhance bằng jQuery Select2 khi thư viện có sẵn; nếu không có thì tự động
fallback về native `<select>`.

Component phải có đầy đủ tính năng tương đương DataTables:

- Dynamic Columns
- Dynamic Search Form
- Select2 cho search field kiểu select
- Server-side Search
- Server-side Sort
- Pagination
- Change Page Size
- Table Statistic
- Toolbar Buttons
- Toast Notifications
- Export All Filtered/Sorted Data
- Loading State
- Empty State
- Custom Cell Renderer
- Action Column
- Event Callback
- Responsive cơ bản

---

# API

## Cấu hình lưu trong DB

Config phải là JSON thuần, không lưu function hoặc JavaScript source trong DB.
Các chức năng động dùng tên `renderer`, `handler` hoặc event handler để resolve
qua registry lúc load.

```javascript
{
    "schemaVersion":1,
    "key":"transactions",
    "header":{
        "title":"Transaction Management",
        "description":"Search and manage transaction records"
    },
    "pageSize":10,
    "pageSizeOptions":[10,20,50,100],
    "columns":[
        { "field":"id", "title":"ID", "width":60, "sortable":true },
        {
            "type":"actions",
            "title":"Transaction Code",
            "actions":[{
                "textField":"transactionCode",
                "href":"#",
                "handler":"openTransactionDetail"
            }]
        },
        {
            "field":"amount",
            "title":"Amount",
            "renderer":"currency"
        }
    ],
    "searchFields":[
        {
            "name":"keyword",
            "label":"Keyword",
            "type":"text",
            "placeholder":"Search..."
        }
    ],
    "buttons":[{
        "type":"dropdown",
        "iconClass":"fa fa-ellipsis-h",
        "title":"Table actions",
        "actions":[
            { "text":"Export Excel", "handler":"exportExcel" },
            { "text":"Import", "handler":"importExcel" },
            { "text":"Delete all", "handler":"deleteAll" }
        ]
    }],
    "events":{
        "onRowClick":"onRowClick",
        "onDataLoaded":"onDataLoaded",
        "onSearchChanged":"onSearchChanged"
    }
}
```

Payload đầy đủ có tại `table-config.json`. File này cũng chính là JSON payload
có thể lưu vào cột `config_json` trong DB.

Schema DB gợi ý (điều chỉnh kiểu JSON theo hệ quản trị đang dùng):

```sql
CREATE TABLE ui_table_config (
    table_key VARCHAR(100) PRIMARY KEY,
    schema_version INTEGER NOT NULL,
    config_json JSON NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP NOT NULL
);
```

## Load config và khởi tạo

Demo dùng `XMLHttpRequest` để load file JSON, không dùng Promise:

```javascript
var TableConfigAPI = {
    load:function(url,callback){
        var request = new XMLHttpRequest();
        request.open("GET",url,true);
        request.onreadystatechange = function(){
            if (request.readyState !== 4) return;
            if (request.status < 200 || request.status >= 300) {
                callback(new Error("Cannot load config: " + request.status));
                return;
            }
            try {
                callback(null,JSON.parse(request.responseText));
            } catch (error) {
                callback(error);
            }
        };
        request.onerror = function(){
            callback(new Error("Network error"));
        };
        request.send(null);
    }
};
```

API search, renderer và callback được khai báo ở code runtime bên ngoài file JSON:

```javascript
TableConfigAPI.load("table-config.json", function(error, config){
    if (error) {
        TableRenderer.toast.error(error.message);
        return;
    }

    var table = TableRenderer.fromConfig(config, {
        containerId:"tableContainer",
        searchFunction:function(request,callback){
            BackendAPI.search(request,callback);
        },
        renderers:{
            currency:function(value,row,index){
                return "$" + Number(value).toLocaleString();
            }
        },
        handlers:{
            openTransactionDetail:function(row,index,event){},
            exportExcel:function(tableInstance,menuItem,event){},
            importExcel:function(tableInstance,menuItem,event){},
            deleteAll:function(tableInstance,menuItem,event){},
            onRowClick:function(row,index){},
            onDataLoaded:function(response){},
            onSearchChanged:function(filters){}
        }
    });
});
```

`runtime.searchFunction` là bắt buộc. Factory báo lỗi rõ ràng nếu config tham
chiếu renderer/handler chưa được đăng ký và tuyệt đối không sử dụng `eval`.

Do browser chặn XHR khi mở bằng `file://`, cần chạy demo qua HTTP, ví dụ từ thư
mục `table_demo`: `python3 -m http.server 8080`, sau đó mở
`http://localhost:8080/demo.html`.

## Reload

```javascript
table.reload();
```

## Search

```javascript
table.search();
```

## Reset Filter

```javascript
table.resetFilter();
```

## Get Current Filter

```javascript
var filter = table.getSearchModel();
```

## Get All Data

Dùng filter và sort hiện tại, gọi lại `searchFunction` với `page = 1` và
`pageSize = total`. Kết quả không thay đổi state hoặc dữ liệu đang hiển thị của table.

```javascript
table.getAllData(function(data, response){
    exportExcel(data);
});
```

## Toolbar Actions Dropdown

Toolbar render nút icon ba chấm ở góc trên bên phải. Click icon mở droplist action.
Trong DB, mỗi action khai báo `handler` là tên function trong runtime registry.
Ngoài ra hỗ trợ `text`, `iconClass`, `className`, `disabled` và `visibleHandler`.

```javascript
buttons:[
    {
        type:"dropdown",
        iconClass:"fa fa-ellipsis-h",
        title:"Table actions",
        actions:[
            {
                text:"Export Excel",
                iconClass:"fa fa-download",
                className:"tr-toolbar-menu-export",
                handler:"exportExcel"
            },
            {
                text:"Import",
                iconClass:"fa fa-upload",
                className:"tr-toolbar-menu-import",
                handler:"importExcel"
            },
            {
                text:"Delete all",
                iconClass:"fa fa-trash",
                className:"tr-toolbar-menu-danger",
                handler:"deleteAll"
            }
        ]
    }
]
```

Click bên ngoài hoặc nhấn Escape sẽ đóng menu. Handler runtime nhận table instance,
DOM menu item và browser event.

---

# Search Request Model

```javascript
{
    page:1,
    pageSize:20,
    sort:{
        field:"createdDate",
        type:"DESC"
    },
    filters:{
        keyword:"abc",
        status:"OPEN"
    }
}
```

---

# Search Response Model

```javascript
{
    total:1543,
    page:1,
    pageSize:20,
    data:[
        {
            id:1,
            name:"Document A"
        }
    ]
}
```

---

# Column Definition

```javascript
{
    field:"name",
    title:"Document Name"
}
```

## Column Width

Mỗi column hỗ trợ `width`, `minWidth`, `maxWidth`. Giá trị số tự chuyển sang px;
chuỗi giữ nguyên đơn vị CSS. Nếu không khai báo thuộc tính nào, component không
gắn width inline và browser tự fit theo title/data bằng table layout mặc định.

```javascript
{
    field:"name",
    title:"Document Name",
    width:200,
    minWidth:160,
    maxWidth:"280px"
}
```

Các option này áp dụng đồng thời cho `th` và `td`, bao gồm action column.

## Sortable

```javascript
{
    field:"createdDate",
    title:"Created Date",
    sortable:true
}
```

## Custom Renderer

DB config chỉ lưu tên renderer:

```javascript
{
    field:"status",
    title:"Status",
    renderer:"statusBadge"
}
```

Function thực thi nằm trong `runtime.renderers` và nhận `(value,row,index)`.

## Action Column

Action được render thành thẻ link và tự dừng propagation nên không gọi
`onRowClick`. Dùng `textField` để lấy label từ row, `handler` để resolve callback,
`visibleHandler`/`hrefHandler` cho logic động.

```javascript
{
    type:"actions",
    title:"Transaction Code",
    actions:[
        {
            textField:"transactionCode",
            href:"#",
            title:"Open transaction detail",
            className:"tr-transaction-link",
            visibleHandler:"canViewTransaction",
            handler:"openTransactionDetail"
        }
    ]
}
```

Runtime row action handler nhận `(row,index,event)`. Có thể truyền `target` nếu
action điều hướng tới URL thật. Khi `href` là `"#"`, component sẽ prevent default; URL thật vẫn điều hướng bình thường sau callback.
Class `tr-transaction-link` hiển thị mã giao dịch như hyperlink thuần, không có
gạch chân, border hoặc background kiểu button. Modal detail có thể dùng
`showConfirmButton:false` để chỉ hiển thị nút đóng.

---

# Search Field Definition

Hỗ trợ text, select, date, daterange.

Field kiểu `select` hỗ trợ Select2 và có thể override option riêng. Mỗi field
có thể cấu hình `width` bằng số (đơn vị px) hoặc chuỗi CSS (`"240px"`, `"25%"`,
`"20rem"`):

```javascript
{
    name:"status",
    label:"Status",
    type:"select",
    width:220,
    placeholder:"Chọn trạng thái",
    options:[
        { value:"OPEN", label:"Open" },
        { value:"CLOSED", label:"Closed" }
    ],
    select2Options:{
        allowClear:true
    }
}
```

Option Select2 dùng chung được truyền qua `select2Options` lúc khởi tạo table.
Mặc định `minimumResultsForSearch = 6`: dưới 6 giá trị sẽ ẩn ô search, từ 6
giá trị trở lên sẽ hiển thị. Option trong từng field được merge và ưu tiên hơn
option dùng chung. `resetFilter()` và `setSearchModel()` phải đồng bộ lại giao
diện Select2.

Mặc định field rộng `180px`, riêng `daterange` rộng `380px`. Trên màn hình nhỏ
hơn `640px`, tất cả field tự động chuyển thành `width: 100%`.

Daterange dùng jQuery UI Datepicker và hỗ trợ placeholder riêng cho hai đầu khoảng
ngày. Ngày bắt đầu tự đặt `minDate` cho ngày kết thúc; ngày kết thúc tự đặt
`maxDate` cho ngày bắt đầu.

```javascript
{
    name:"createdDate",
    type:"daterange",
    fromPlaceholder:"Từ ngày",
    toPlaceholder:"Đến ngày",
    datepickerOptions:{
        dateFormat:"dd/mm/yy",
        searchDateFormat:"yy-mm-dd"
    }
}
```

Option dùng chung truyền qua `datepickerOptions`; option trong field được merge và
ưu tiên hơn. Mặc định component dùng `dateFormat:"yy-mm-dd"` và
`showButtonPanel:true`. `resetFilter()` và `setSearchModel()` đồng bộ lại widget.
Popup jQuery UI Datepicker được theme bằng `--purple-color`.

---

# Sorting

Chu kỳ `sort.type`:

```text
ASC -> DESC -> NONE
```

Khi không sort, `sort` có giá trị:

```javascript
{
    field:null,
    type:null
}
```

Cập nhật sort bằng object:

```javascript
table.setSort({
    field:"createdDate",
    type:"DESC"
});
```

---

# Pagination

- First
- Previous
- Next
- Last
- Jump page

---

# Page Size

10 / 20 / 50 / 100

Hiển thị ở góc dưới bên trái table và được enhance bằng Select2. Page-size kế
thừa `minimumResultsForSearch` từ `select2Options`, nên 4 giá trị mặc định không
hiển thị ô search. Có thể override riêng qua `pageSizeSelect2Options`.

Đổi page size phải reset page = 1. Focus/selected dùng theme Select2 từ root.

---

# Table Statistic

Hiển thị ở góc trên bên trái table.

Ví dụ:

Showing 21 to 40 of 1543 entries

---

# Loading State

Hiển thị overlay Loading trong lúc gọi API.

---

# Empty State

No data found

---

# Toast Notifications

Toast API có sẵn trên table instance và static `TableRenderer.toast`:

```javascript
table.toast.success("Đã lưu dữ liệu", "Thành công");
table.toast.error("Không thể lưu dữ liệu", "Lỗi", { duration:5000 });
table.toast.info("Đang xử lý", "Thông báo");
table.toast.warning("Vui lòng kiểm tra dữ liệu", "Cảnh báo");
```

Options hỗ trợ:

```javascript
{
    duration:3500,       // 0 để không tự đóng
    closeButton:true,
    position:"top-right", // top-left, bottom-right, bottom-left
    onClick:function(toast,event){}
}
```

Dùng `table.toast.clear()` để xóa toàn bộ toast đang hiển thị. Nội dung được render
bằng text node để tránh chèn HTML ngoài ý muốn.

---

# Event Callback

```javascript
onRowClick(row,index)
action.onClick(row,index,event)
onDataLoaded(response)
onSearchChanged(filters)
```

---

# Static APIs

```javascript
TableRenderer.fromConfig(config,runtime)
TableRenderer.toast.success(message,title,options)
TableRenderer.toast.error(message,title,options)
```

# Public Methods

```javascript
reload()
search()
resetFilter()
gotoPage(page)
setPageSize(size)
setSort(sort)
getSearchModel()
getAllData(callback)
setSearchModel(model)
```

---

# Internal State

```javascript
{
    page:1,
    pageSize:20,
    total:0,
    sort:{
        field:null,
        type:null
    },
    filters:{}
}
```

---

# Compatibility

Bắt buộc ES5. Hỗ trợ các phiên bản hiện đại của Chrome, Edge, Firefox và Safari.

jQuery UI Datepicker và Select2 là progressive enhancement. Demo sử dụng:

- Font Awesome 4.7.0
- jQuery 3.6.0
- jQuery UI 1.13.3
- Select2 (local build trong `libs/select2`)

Thứ tự load script: jQuery -> jQuery UI -> Select2 -> `table.js`. Nếu Select2
không tồn tại, component fallback về native `<select>`. Date field fallback về
text input nếu jQuery UI Datepicker không tồn tại.

Không sử dụng:

- let
- const
- Promise
- async/await
- arrow function
- class syntax

---

# Deliverables

Sinh các file:

```text
table.js
table.css
demo.html
```

Demo phải mock API bằng setTimeout và chạy độc lập.
