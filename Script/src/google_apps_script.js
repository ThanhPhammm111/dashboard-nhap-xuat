/**
 * Google Apps Script Web App
 * URL: https://script.google.com/macros/s/AKfycbxjgLp7BLGvrobzvjZkzQIrZ-l2bv63gRipVB-u0SKP52v6DdEMIP3kKJB87hF3DExTgw/exec
 * 
 * Instructions:
 * 1. Open the Google Spreadsheet (1O5z-i4rsx0pT9Xr5x4BpculOJr8rPeC-Yz8glLidJcA).
 * 2. Click Extensions -> Apps Script.
 * 3. Replace the entire code in Editor with the code below.
 * 4. Click Save icon.
 * 5. Click Deploy -> Manage deployments.
 * 6. Click the pencil icon (Edit) on the Active deployment, change the Version to "New version", and click Deploy.
 */

function doPost(e) {
  try {
    var request = JSON.parse(e.postData.contents);
    
    // Support both new structured payload and old direct array payload
    var sheetName = "DATA Thực xuất";
    var rawData = [];
    
    if (request.sheetName && request.data) {
      sheetName = request.sheetName;
      rawData = request.data;
    } else if (Array.isArray(request)) {
      rawData = request;
    }
    
    if (!rawData || rawData.length <= 1) {
      return ContentService.createTextOutput("SUCCESS: No data to append");
    }

    var ss = null;
    try {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    } catch (e) {}
    
    if (!ss) {
      for (var openAttempt = 0; openAttempt < 3; openAttempt++) {
        try {
          ss = SpreadsheetApp.openById("1O5z-i4rsx0pT9Xr5x4BpculOJr8rPeC-Yz8glLidJcA");
          if (ss) break;
        } catch (openErr) {
          Utilities.sleep(1000);
        }
      }
    }
    
    if (!ss) {
      return ContentService.createTextOutput("ERROR: Unable to open spreadsheet 1O5z-i4rsx0pT9Xr5x4BpculOJr8rPeC-Yz8glLidJcA");
    }
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      return ContentService.createTextOutput("ERROR: Sheet not found: " + sheetName);
    }

    // 1. Load Loại hàng mapping from tab "Loại Hàng" (only if needed)
    var loaiHangMap = null;
    function getLoaiHangMap() {
      if (loaiHangMap !== null) return loaiHangMap;
      loaiHangMap = {};
      try {
        var loaiHangSheet = ss.getSheetByName("Loại Hàng");
        if (loaiHangSheet) {
          var loaiHangData = loaiHangSheet.getDataRange().getValues();
          for (var i = 1; i < loaiHangData.length; i++) {
            var code = String(loaiHangData[i][0]).trim();
            var type = String(loaiHangData[i][1]).trim();
            if (code) {
              loaiHangMap[code] = type;
            }
          }
        }
      } catch (err) {
        Logger.log("Error loading Loại Hàng mapping: " + err.message);
      }
      return loaiHangMap;
    }

    // 2. Map and parse date rows
    var dataRows = rawData.slice(1);
    var targetRows = [];

    var lastRow = sheet.getLastRow();
    var isNhp = (sheetName === "Data thực nhập");
    var isBooking = (sheetName.toLowerCase().indexOf("booking") >= 0);
    var codeColIndex = isBooking ? 4 : (isNhp ? 5 : 4); // Column E (index 4) for Booking (Mã hàng), Column F (index 5) for Nhập, Column E (index 4) for Xuất

    for (var i = 0; i < dataRows.length; i++) {
      var row = dataRows[i];
      
      // Auto-fill Loại hàng in Column B if empty
      if (!row[1]) {
        var productCode = String(row[codeColIndex]).trim();
        var map = getLoaiHangMap();
        var loaiHangVal = map[productCode] || "";
        row[1] = loaiHangVal;
      }
      
      // Parse first column date string (dd/mm/yyyy) into a Date object
      if (row[0]) {
        var dateStr = String(row[0]).split(" ")[0]; // Strip time if exists
        var dateParts = dateStr.split("/");
        if (dateParts.length === 3) {
          row[0] = new Date(Number(dateParts[2]), Number(dateParts[1]) - 1, Number(dateParts[0]));
        }
      }
      
      targetRows.push(row);
    }

    // 3. Xóa dữ liệu ngày cũ (Tìm siêu tốc qua mảng bộ nhớ JS, tránh lockup TextFinder)
    var targetDateStr = formatDateDDMMYYYY(targetRows[0][0]);
    if (request.mode !== "append" && targetDateStr) {
      var colAValues = sheet.getRange("A1:A" + Math.min(sheet.getLastRow(), 50000)).getValues();
      var firstMatchIdx = -1;
      var matchCount = 0;
      for (var r = 0; r < colAValues.length; r++) {
        var dStr = formatDateDDMMYYYY(colAValues[r][0]);
        if (dStr === targetDateStr) {
          if (firstMatchIdx === -1) firstMatchIdx = r + 1;
          matchCount++;
        }
      }
      if (firstMatchIdx !== -1 && matchCount > 0) {
        sheet.deleteRows(firstMatchIdx, matchCount);
      }
    }

    // 4. Append rows to target sheet
    var lastRowInColA = getLastRowInColA(sheet);
    var startRow = lastRowInColA + 1;
    var numRows = targetRows.length;
    var numCols = targetRows[0].length;
    
    var range = sheet.getRange(startRow, 1, numRows, numCols);
    range.setValues(targetRows);

    // 5. Drag/Copy formulas down (Chỉ kéo công thức cho các dòng MỚI NẠP trong đợt này trong 0.2s)
    var formulaStartCol = isBooking ? 9 : (isNhp ? 11 : 9);
    var totalCols = sheet.getLastColumn();
    var numFormulaCols = totalCols - formulaStartCol + 1;
    
    if (numFormulaCols > 0 && numRows > 0) {
      var formulasR1C1 = null;
      var lastRowWithData = sheet.getLastRow();
      
      for (var r = 2; r <= Math.min(10, lastRowWithData); r++) {
        var testRange = sheet.getRange(r, formulaStartCol, 1, numFormulaCols);
        var testFormulas = testRange.getFormulasR1C1();
        var hasFormula = false;
        for (var c = 0; c < testFormulas[0].length; c++) {
          if (testFormulas[0][c] && String(testFormulas[0][c]).indexOf('=') === 0) {
            hasFormula = true;
            break;
          }
        }
        if (hasFormula) {
          formulasR1C1 = testFormulas;
          break;
        }
      }
      
      if (formulasR1C1) {
        var batchFormulasR1C1 = [];
        for (var k = 0; k < numRows; k++) {
          batchFormulasR1C1.push(formulasR1C1[0]);
        }
        
        var targetRange = sheet.getRange(startRow, formulaStartCol, numRows, numFormulaCols);
        targetRange.setFormulasR1C1(batchFormulasR1C1);
      }
    }

    return ContentService.createTextOutput("SUCCESS: Appended " + numRows + " rows to " + sheetName);
  } catch (error) {
    return ContentService.createTextOutput("ERROR: " + error.message);
  }
}

function isRowEqual(row1, row2) {
  // So sanh tat ca cac cot ngoai tru cot index 1 (Loại hàng)
  for (var k = 0; k < row1.length; k++) {
    if (k === 1) continue; 
    var val1 = row1[k];
    var val2 = row2[k];
    
    if (val1 instanceof Date && val2 instanceof Date) {
      if (val1.getTime() !== val2.getTime()) return false;
    } else {
      if (String(val1).trim() !== String(val2).trim()) return false;
    }
  }
  return true;
}

function formatDateDDMMYYYY(val) {
  if (!val) return "";
  if (val instanceof Date) {
    var d = val.getDate();
    var m = val.getMonth() + 1;
    var y = val.getFullYear();
    return (d < 10 ? "0" + d : d) + "/" + (m < 10 ? "0" + m : m) + "/" + y;
  }
  var s = String(val).trim().split(" ")[0];
  var parts = s.split("/");
  if (parts.length === 3) {
    var d = Number(parts[0]);
    var m = Number(parts[1]);
    var y = Number(parts[2]);
    if (d > 0 && m > 0 && y > 1900) {
      return (d < 10 ? "0" + d : d) + "/" + (m < 10 ? "0" + m : m) + "/" + y;
    }
  }
  return s;
}

function getLastRowInColA(sheet) {
  var values = sheet.getRange("A:A").getValues();
  for (var i = values.length - 1; i >= 0; i--) {
    if (values[i][0] !== "" && values[i][0] !== null && values[i][0] !== undefined) {
      return i + 1;
    }
  }
  return 0;
}
