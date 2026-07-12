// Antigravity Reconciliation Core Engine
// Shared by both Web Worker (for background threads) and Main Thread (for file:// fallbacks)

// Parse file content depending on extension (.xlsx, .xls, .csv, etc.)
function parseFile(content, fileName) {
    const extension = fileName.split('.').pop().toLowerCase();
    
    if (extension === "csv") {
        let csvText = "";
        if (content instanceof ArrayBuffer) {
            const decoder = new TextDecoder("utf-8");
            csvText = decoder.decode(content);
            if (csvText.includes("")) {
                const utf16decoder = new TextDecoder("utf-16le");
                csvText = utf16decoder.decode(content);
            }
        } else {
            csvText = content;
        }
        return parseCsvText(csvText);
    } else {
        // Excel binary read (XLSX must be loaded in scope)
        const data = new Uint8Array(content);
        const workbook = XLSX.read(data, { type: "array", raw: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        return XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
    }
}

// Simple but robust CSV parser in JS that handles quotes and commas
function parseCsvText(text) {
    const lines = text.split(/\r?\n/);
    const result = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const row = [];
        let inQuotes = false;
        let current = "";
        
        for (let j = 0; j < line.length; j++) {
            const c = line[j];
            if (c === '"') {
                if (inQuotes && j + 1 < line.length && line[j + 1] === '"') {
                    current += '"';
                    j++; // skip next quote
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (c === ',' && !inQuotes) {
                row.push(current);
                current = "";
            } else {
                current += c;
            }
        }
        row.push(current);
        result.push(row);
    }
    return result;
}

// Find column index matching keywords (case-insensitive)
function findCol(headerRow, keywords) {
    if (!headerRow) return -1;
    for (let i = 0; i < headerRow.length; i++) {
        const cell = String(headerRow[i] || "").trim().toLowerCase();
        for (const kw of keywords) {
            if (cell.includes(kw.toLowerCase())) {
                return i;
            }
        }
    }
    return -1;
}

// Build mapping Dictionary from Data ST
function buildStMapping(stRows) {
    if (stRows.length < 2) throw new Error("File DATA ST trống hoặc không hợp lệ.");
    
    const header = stRows[0];
    let colName = findCol(header, ["Nơi nhận", "Noi nhan"]);
    let colAbbr = findCol(header, ["viết tắt", "viet tat", "viết tắt", "abbr"]);
    
    if (colName === -1) colName = 0;
    if (colAbbr === -1) colAbbr = 1;
    
    const mapping = {};
    for (let i = 1; i < stRows.length; i++) {
        const row = stRows[i];
        if (row.length > Math.max(colName, colAbbr)) {
            const name = String(row[colName] || "").trim();
            const abbr = String(row[colAbbr] || "").trim();
            if (name) {
                mapping[name.toLowerCase()] = abbr;
            }
        }
    }
    return mapping;
}

// Process KFM Rows
function processKfm(rows, stMapping) {
    if (rows.length < 2) throw new Error("File KFM trống hoặc không hợp lệ.");
    
    const header = rows[0];
    let colBranch = findCol(header, ["Chi nhánh nhận", "Chi nhanh nhan", "branch"]);
    let colProduct = findCol(header, ["Mã hàng", "Ma hang", "sku", "product"]);
    let colQty = findCol(header, ["Số lượng chuyển", "So luong chuyen", "qty", "soluong"]);
    let colProductName = findCol(header, ["Tên hàng", "Ten hang", "name"]);
    
    // Fallbacks
    if (colBranch === -1) colBranch = 3;
    if (colProduct === -1) colProduct = 7;
    if (colProductName === -1) colProductName = 8;
    if (colQty === -1) colQty = 10;
    
    const kfmDict = {};
    const productNameMap = {};
    
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length <= Math.max(colBranch, colProduct, colQty)) continue;
        
        const branch = String(row[colBranch] || "").trim();
        const product = String(row[colProduct] || "").trim();
        const productName = String(row[colProductName] || "").trim();
        const qtyStr = String(row[colQty] || "").trim().replace(/,/g, "");
        
        if (!product) continue;
        
        // Rule: Filter out products starting with 'C'
        if (product.toUpperCase().startsWith("C")) {
            continue;
        }
        
        // Map branch name to ST abbreviation
        let stAbbr = branch;
        const branchLower = branch.toLowerCase();
        if (stMapping[branchLower]) {
            stAbbr = stMapping[branchLower];
        }
        
        const key = `${stAbbr}_${product}`;
        const qty = parseFloat(qtyStr) || 0;
        
        if (productName && !productNameMap[product]) {
            productNameMap[product] = productName;
        }
        
        kfmDict[key] = (kfmDict[key] || 0) + qty;
    }
    
    return { kfmDict, productNameMap };
}

// Process ABA Rows
function processAba(rows, productNameMap) {
    if (rows.length < 2) throw new Error("File ABA trống hoặc không hợp lệ.");
    
    const header = rows[0];
    let colST = findCol(header, ["Mã CH", "Ma CH", "Mã ST", "store"]);
    let colProduct = findCol(header, ["Mã SP", "Ma SP", "sku", "product"]);
    let colQty = findCol(header, ["Số lượng giao", "So luong giao", "qty", "soluong"]);
    let colProductName = findCol(header, ["Tên SP", "Ten SP", "Tên hàng", "name"]);
    let colCategory = findCol(header, ["Category", "nhóm"]);
    let colLoaiHang = findCol(header, ["Loại hàng", "Loai hang", "type"]);
    
    // Fallbacks
    if (colST === -1) colST = 1;
    if (colProduct === -1) colProduct = 5;
    if (colProductName === -1) colProductName = 6;
    if (colQty === -1) colQty = 9;
    if (colCategory === -1) colCategory = 17;
    if (colLoaiHang === -1) colLoaiHang = 16;
    
    const abaDict = {};
    const productMetaMap = {};
    
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length <= Math.max(colST, colProduct, colQty)) continue;
        
        const stCode = String(row[colST] || "").trim();
        const product = String(row[colProduct] || "").trim();
        const productName = String(row[colProductName] || "").trim();
        const qtyStr = String(row[colQty] || "").trim().replace(/,/g, "");
        const category = colCategory !== -1 && row[colCategory] ? String(row[colCategory]).trim() : "";
        const loaiHang = colLoaiHang !== -1 && row[colLoaiHang] ? String(row[colLoaiHang]).trim() : "";
        
        if (!product) continue;
        
        const key = `${stCode}_${product}`;
        const qty = parseFloat(qtyStr) || 0;
        
        if (productName && !productNameMap[product]) {
            productNameMap[product] = productName;
        }
        
        if (!productMetaMap[product]) {
            productMetaMap[product] = {
                category: category,
                loaiHang: loaiHang
            };
        }
        
        abaDict[key] = (abaDict[key] || 0) + qty;
    }
    
    return { abaDict, productMetaMap };
}

// Perform Reconciliation & Diff Calculations
function performReconciliation(kfmDict, abaDict, productNameMap, productMetaMap) {
    const allKeys = new Set([...Object.keys(kfmDict), ...Object.keys(abaDict)]);
    const results = [];
    const warningDict = {};
    const stLechSet = new Set();
    const stAllSet = new Set();
    
    // Extract all unique stores for stats
    for (const key of allKeys) {
        const [st] = key.split("_");
        if (st) stAllSet.add(st);
    }
    
    for (const key of allKeys) {
        const kfmQty = kfmDict[key] || 0;
        const abaQty = abaDict[key] || 0;
        const diff = kfmQty - abaQty;
        
        // If no difference, ignore
        if (diff === 0) continue;
        
        const [st, prod] = key.split("_");
        stLechSet.add(st);
        
        const name = productNameMap[prod] || "Chưa cập nhật tên";
        const meta = productMetaMap[prod] || { category: "", loaiHang: "" };
        const category = meta.category || "";
        const loaiHang = meta.loaiHang || "";
        
        // Group warnings by Store and Category (for notifications/high-level alerts)
        const catInfo = category || loaiHang || "Khác";
        const wKey = `${st}|${catInfo}`;
        warningDict[wKey] = (warningDict[wKey] || 0) + diff;
        
        results.push({
            key,
            st,
            productCode: prod,
            productName: name,
            category,
            loaiHang,
            kfmQty,
            abaQty,
            diff
        });
    }
    
    // Format warnings array
    const warnings = Object.keys(warningDict).map(wKey => {
        const [st, catInfo] = wKey.split("|");
        return {
            st,
            category: catInfo,
            diff: warningDict[wKey]
        };
    }).sort((a, b) => a.st.localeCompare(b.st));
    
    return {
        results,
        warnings,
        stats: {
            totalSt: stAllSet.size,
            mismatchedSt: stLechSet.size,
            mismatchedStList: Array.from(stLechSet).sort()
        }
    };
}
