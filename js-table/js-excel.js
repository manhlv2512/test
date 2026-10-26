function should_format_number(key, headers) {
  for (var h of headers) {
    if (h.key === key) return h.formatNumber;
  }
  return undefined;
}

var ExcelConst = {
  EXCEL_FORMAT_TEXT: "@",
  EXCEL_FORMAT_NUMBER: "#,##0",
  EXCEL_FORMAT_DATE: "yyyy/mm/dd",
  // EXCEL_FORMAT_TEXT: 10000,
  // EXCEL_FORMAT_TEXT: 50,
}

var ExcelUtils = {

  /**
   * @param fileName
   * @param data mảng chứa thông tin {headers, listData, sheetName = null}
   * @param data -> headers mảng chứa thông tin các cột {key: 'userCode', value: 'Mã NV', width: 15, fillColor: "FFFFFF", align: "center"}
   *                key: để lấy dữ liệu trong mảng listData
   *                value: text hiển thị
   *                width: độ rộng của cột
   * @param data -> listData dữ liệu xuất excel
   * @param data -> sheetName tên sheet
   * @param options -> chứa object dữ liệu option truyền vào
   * @param options.customHeaders -> mảng chứa cấu hình các dòng tiêu đề tùy chỉnh
   *                [
   *                  {
   *                    text: "Nội dung", // giá trị hiển thị
   *                    merge: true, // có merge cell hay không
   *                    style: {
   *                      font: { sz: 14, bold: true, name: 'Times New Roman' },
   *                      alignment: { horizontal: "left", vertical: "center" },
   *                      fill: { patternType: 'solid', fgColor: { rgb: "b1a0c7" } }
   *                    }
   *                  },
   *                  ...
   *                ]
   */
  cloneObject(obj) {
    return JSON.parse(JSON.stringify(obj));
  },
  export(fileName, data, options = null) {
    if (!fileName.includes('.xls')) fileName = `${fileName}.xlsx`;
    if (!Array.isArray(data)) data = [data];

    var styleHeader = {
      fill: {
        patternType: 'solid',
        fgColor: { rgb: "b1a0c7" }
      },
      font: {
        sz: 13,
        bold: true,
        color: { rgb: "000000" },
        name: 'Times New Roman'
      },
      alignment: {
        horizontal: "center",
        vertical: "center",
        wrapText: true
      },
      numFmt: ExcelConst.EXCEL_FORMAT_TEXT,
      border: {
        top: { style: 'thin', color: { rgb: "000000" } },
        bottom: { style: 'thin', color: { rgb: "000000" } },
        left: { style: 'thin', color: { rgb: "000000" } },
        right: { style: 'thin', color: { rgb: "000000" } }
      }
    }

    var wb = { SheetNames: [], Sheets: {} };
    data.forEach(function (item, index) {
      var sheetName = item.sheetName || `Sheet${index + 1}`;
      var headers = item.headers;
      var listData = item.listData;
      var ws = {};
      var range = { s: { c: 0, r: 0 }, e: { c: 0, r: 0 } };
      var wscols = [];
      var C = 0, R = 0;
      var DEFAULT_COLUMN_WIDTH = 20;

      // Xử lý custom headers nếu có
      if (options && options.customHeaders && options.customHeaders.length > 0) {
        var mergeCols = headers.length - 1;
        // Lấy config merge chung nếu có
        var globalMergeFrom = options.customHeaderMergeFrom != null ? options.customHeaderMergeFrom : 0;
        var globalMergeTo = options.customHeaderMergeTo != null ? options.customHeaderMergeTo : mergeCols;

        options.customHeaders.forEach(headerConfig => {
          // Tạo style mặc định nếu không có style từ config
          var defaultStyle = {
            font: { sz: 14, bold: false, name: 'Times New Roman', color: { rgb: "000000" } },
            alignment: { horizontal: "left", vertical: "center" },
            fill: { patternType: 'solid', fgColor: { rgb: "FFFFFF" } },
            border: {}
          };
          // Merge style từ config với style mặc định
          var cellStyle = headerConfig.style ? deepMerge(defaultStyle, headerConfig.style) : defaultStyle;
          var fromCol = headerConfig.mergeFrom != null ? headerConfig.mergeFrom : globalMergeFrom;
          var toCol = headerConfig.mergeTo != null ? headerConfig.mergeTo : globalMergeTo;
          // Tạo cell đầu tiên (có nội dung + style đầy đủ)
          var cellRefStart = XLSX.utils.encode_cell({ c: fromCol, r: R });
          ws[cellRefStart] = {
            v: headerConfig.text || '',
            t: 's',
            s: cellStyle
          };


          // Merge nếu không bị tắt và có khoảng merge
          if (headerConfig.merge !== false && toCol > fromCol) {// Mặc định merge nếu không chỉ định
            ws['!merges'] = ws['!merges'] || [];
            ws['!merges'].push({
              s: { r: R, c: fromCol },
              e: { r: R, c: toCol }
            });
            // Gán các ô còn lại trong vùng merge nhưng KHÔNG border
            for (var col = fromCol + 1; col <= toCol; col++) {
              var cellRef = XLSX.utils.encode_cell({ c: col, r: R });
              ws[cellRef] = {
                v: '',
                t: 's',
                s: {
                  border: cellStyle.border || {
                    top: { style: "thin" },
                    bottom: { style: "thin" },
                    left: { style: "thin" },
                    right: { style: "thin" }
                  },
                  alignment: cellStyle.alignment || { horizontal: "center", vertical: "center" }
                }
              };
            }
          }
          // ✅ Merge phần còn lại nếu toCol < mergeCols
          if (toCol < mergeCols) {
            var blankFromCol = toCol + 1;
            var blankToCol = mergeCols;

            ws['!merges'] = ws['!merges'] || [];
            ws['!merges'].push({
              s: { r: R, c: blankFromCol },
              e: { r: R, c: blankToCol }
            });

            // Gán ô trống không nội dung, không border
            for (var col = blankFromCol; col <= blankToCol; col++) {
              var cellRef = XLSX.utils.encode_cell({ c: col, r: R });
              ws[cellRef] = {
                v: '',
                t: 's',
                s: {
                  border: {},
                  fill: {
                    patternType: 'solid',
                    fgColor: { rgb: 'FFFFFF' }
                  },
                  alignment: { horizontal: "center", vertical: "center" }
                }
              };
            }
          }

          // Cập nhật phạm vi
          range.e.r = Math.max(range.e.r, R);
          range.e.c = Math.max(range.e.c, toCol);
          R++;
        });

        // Thêm dòng trống sau custom headers
        // R++; //Không thêm nữa, muốn thêm thì thêm dòng trống vào data => để đồng nhất xử lý style header
      }
      // Xử lý phần còn lại giữ nguyên như cũ
      for (var i = 0; i < headers.length; i++) {
        if (range.s.r > R) range.s.r = R;
        if (range.s.c > C) range.s.c = C;
        if (range.e.r < R) range.e.r = R;
        if (range.e.c < C) range.e.c = C;
        var cell = { v: headers[i]['value'], t: 's', s: styleHeader, z: ExcelConst.EXCEL_FORMAT_TEXT };
        if (headers[i]['fillColor']) {
          cell.s = ExcelUtils.cloneObject(styleHeader);
          cell.s.fill.fgColor.rgb = headers[i]['fillColor'];
        }
        var width = headers[i]['width'] || DEFAULT_COLUMN_WIDTH;
        wscols.push({ wch: width });
        var cell_ref = XLSX.utils.encode_cell({ c: C, r: R });
        ws[cell_ref] = cell;
        C++;
      }

      // Phần còn lại của code giữ nguyên...
      var styleCell = ExcelUtils.cloneObject(styleHeader);
      styleCell.font.bold = false;
      styleCell.font.sz = 12;
      styleCell.fill.patternType = 'none';
      var alignments = {};
      var keys = headers.map(function (it) {
        alignments[it.key] = it.align || "center";
        return it.key;
      });
      for (var i = 0; i < listData.length; i++) {
        C = 0;
        R++;
        for (var key of keys) {
          if (range.s.r > R) range.s.r = R;
          if (range.s.c > C) range.s.c = C;
          if (range.e.r < R) range.e.r = R;
          if (range.e.c < C) range.e.c = C;
          var cellValue = listData[i][key];
          if (cellValue === null || cellValue === undefined) {
            cellValue = '';
          }
          var alignCell = { alignment: { horizontal: alignments[key], vertical: "center", wrapText: true } };
          var cell = { v: cellValue, t: 's', s: { ...styleCell, ...alignCell }, z: ExcelConst.EXCEL_FORMAT_TEXT };
          var formatNumber = should_format_number(key, headers);
          if (formatNumber) {
            cell.t = 'n';
            cell.z = cell.s.numFmt = formatNumber;
          } else if (options && options.formatDates && options.formatDates[key]) {
            if (typeof cell.v === 'string' && cell.v.length > 0) {
              cell.t = 'd';
            }
            cell.z = cell.s.numFmt = options.formatDates[key];
          }
          var cell_ref = XLSX.utils.encode_cell({ c: C, r: R });
          ws[cell_ref] = cell;
          C++;
        }
      }
      ws['!cols'] = wscols;
      ws['!ref'] = XLSX.utils.encode_range(range);
      wb.SheetNames.push(sheetName);
      wb.Sheets[sheetName] = ws;
    });

    return XLSX.writeFile(wb, fileName, { bookType: 'xlsx', bookSST: false, type: 'binary' });
  },

  // Phần readFile giữ nguyên...
  readFile(file, option, cb) {
    var reader = new FileReader();
    var raw = true;
    if (Object.keys(option).length) {
      raw = false
      option = { ...option, type: 'array' }
    } else {
      option = { type: 'array' };
    }

    reader.onload = function (e) {
      var data = e.target.result;
      data = new Uint8Array(data);
      var workbook = XLSX.read(data, option);
      let results = [];
      var sheetNames = workbook.SheetNames || [];
      sheetNames.forEach(function (sheetName) {
        var ws = workbook.Sheets[sheetName];
        var rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
        if (rows.length) results.push(rows);
      });
      cb({ sheetNames: sheetNames, results: results });
    };
    reader.readAsArrayBuffer(file);
  }
}

// Hàm deep merge
function deepMerge(target, source) {
  if (typeof target !== 'object' || typeof source !== 'object') {
    return source || target;
  }

  var merged = { ...target };
  for (var key in source) {
    if (source.hasOwnProperty(key)) {
      if (target.hasOwnProperty(key)) {
        merged[key] = deepMerge(target[key], source[key]);
      } else {
        merged[key] = source[key];
      }
    }
  }
  return merged;
}