/**
 * Google Apps Script Web App
 * URL: https://script.google.com/macros/s/AKfycbzaVLooO814joo92lj9Bt4eQ4UGCJ52o0SpdwSzds_jN6P1hpsf9-oJRRc0e_4JIZ2fZg/exec
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

    var ss = SpreadsheetApp.openById("1O5z-i4rsx0pT9Xr5x4BpculOJr8rPeC-Yz8glLidJcA");
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      return ContentService.createTextOutput("ERROR: Sheet not found: " + sheetName);
    }

    // 1. Load Loại hàng mapping from tab "Loại Hàng"
    var loaiHangMap = {};
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
      Logger.log("Error loading Jenis Hàng mapping: " + err.message);
    }

    // 2. Map and parse date rows
    var dataRows = rawData.slice(1);
    var targetRows = [];

    var lastRow = sheet.getLastRow();
    var isNhp = (sheetName === "Data thực nhập");
    var codeColIndex = isNhp ? 5 : 4; // Column F (index 5) for Nhập, Column E (index 4) for Xuất

    for (var i = 0; i < dataRows.length; i++) {
      var row = dataRows[i];
      
      // Auto-fill Loại hàng in Column B
      var productCode = String(row[codeColIndex]).trim();
      var loaiHangVal = loaiHangMap[productCode] || "";
      row[1] = loaiHangVal; // Set Column B
      
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

    // 3. Kiem tra trung lap va ghi de du lieu
    var targetDateObj = targetRows[0][0];
    if (targetDateObj instanceof Date) {
      var targetTime = targetDateObj.getTime();
      var allData = sheet.getDataRange().getValues();
      var rowsToDelete = [];
      var existingRows = [];
      
      for (var r = 1; r < allData.length; r++) {
        var dateVal = allData[r][0];
        if (dateVal instanceof Date && dateVal.getTime() === targetTime) {
          rowsToDelete.push(r + 1);
          existingRows.push(allData[r]);
        }
      }
      
      var isIdentical = false;
      if (existingRows.length === targetRows.length) {
        isIdentical = true;
        for (var i = 0; i < targetRows.length; i++) {
          if (!isRowEqual(targetRows[i], existingRows[i])) {
            isIdentical = false;
            break;
          }
        }
      }
      
      if (isIdentical) {
        return ContentService.createTextOutput("SUCCESS: Data for " + Utilities.formatDate(targetDateObj, Session.getScriptTimeZone(), "dd/MM/yyyy") + " is identical. Skipped upload to avoid duplicates.");
      }
      
      if (rowsToDelete.length > 0) {
        var ranges = [];
        var startIdx = rowsToDelete[0];
        var currentCount = 1;
        for (var k = 1; k < rowsToDelete.length; k++) {
          if (rowsToDelete[k] === startIdx + currentCount) {
            currentCount++;
          } else {
            ranges.push({ start: startIdx, count: currentCount });
            startIdx = rowsToDelete[k];
            currentCount = 1;
          }
        }
        ranges.push({ start: startIdx, count: currentCount });
        
        for (var j = ranges.length - 1; j >= 0; j--) {
          sheet.deleteRows(ranges[j].start, ranges[j].count);
        }
        SpreadsheetApp.flush();
        lastRow = sheet.getLastRow(); // Cap nhat lai lastRow sau khi xoa
      }
    }

    // 4. Append rows to target sheet
    var startRow = lastRow + 1;
    var numRows = targetRows.length;
    var numCols = targetRows[0].length;
    
    var range = sheet.getRange(startRow, 1, numRows, numCols);
    range.setValues(targetRows);

    // 5. Drag/Copy formulas down
    // DATA Thực xuất: Formulas start at column 9 (I) to 14 (N)
    // Data thực nhập: Formulas start at column 11 (K) to 26 (Z)
    if (lastRow >= 2) {
      var formulaStartCol = isNhp ? 11 : 9;
      var totalCols = sheet.getLastColumn();
      var numFormulaCols = totalCols - formulaStartCol + 1;
      
      if (numFormulaCols > 0) {
        var sourceRange = sheet.getRange(lastRow, formulaStartCol, 1, numFormulaCols);
        var targetRange = sheet.getRange(startRow, formulaStartCol, numRows, numFormulaCols);
        sourceRange.copyTo(targetRange, SpreadsheetApp.CopyPasteType.PASTE_NORMAL, false);
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
