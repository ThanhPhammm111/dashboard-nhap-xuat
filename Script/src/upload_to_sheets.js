const fs = require('fs');
const path = require('path');

// Configuration
const csvPath = process.argv[2] || 'C:\\temp_restore\\clean_kfm.csv';
const webAppUrl = 'https://script.google.com/macros/s/AKfycbxjgLp7BLGvrobzvjZkzQIrZ-l2bv63gRipVB-u0SKP52v6DdEMIP3kKJB87hF3DExTgw/exec';

if (!fs.existsSync(csvPath)) {
  console.error(`\n=== GOOGLE SHEETS UPLOAD FAILED ===`);
  console.error(`Loi: Khong tim thay file CSV tai ${csvPath}`);
  process.exit(1);
}

// RFC 4180 compliant CSV parser without external library dependencies
function parseCsv(content) {
  const lines = content.split(/\r?\n/);
  const result = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const row = [];
    let inQuotes = false;
    let current = '';
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        row.push(current);
        current = '';
      } else {
        current += c;
      }
    }
    row.push(current);
    result.push(row);
  }
  return result;
}

async function upload() {
  console.log(`\n=== UPLOADING TO GOOGLE SHEETS ===`);
  console.log(`Doc du lieu tu: ${csvPath}`);
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const data = parseCsv(csvContent);

  if (data.length <= 1) {
    console.log('Khong co du lieu thuc te nao de day len Sheet (chi co dong Tieu de). Bo qua.');
    return;
  }

  let sheetName = 'DATA Thực xuất';
  if (process.argv[3]) {
    const arg = process.argv[3];
    const argLower = arg.toLowerCase();
    if (argLower.includes('nhập') || argLower.includes('nhap') || argLower.includes('import')) {
      sheetName = 'Data thực nhập';
    } else if (argLower.includes('xuất') || argLower.includes('xuat') || argLower.includes('export')) {
      sheetName = 'DATA Thực xuất';
    } else if (argLower.includes('booking')) {
      sheetName = 'DATA Booking';
    } else {
      sheetName = arg;
    }
  }

  const mode = process.argv[4] || 'replace';
  const header = data[0];
  const rows = data.slice(1);
  const totalDataRows = rows.length;
  const BATCH_SIZE = 3000;
  const totalBatches = Math.ceil(totalDataRows / BATCH_SIZE);

  console.log(`Tong so dòng du lieu: ${totalDataRows}. Chia thanh ${totalBatches} đot (Moi đot ${BATCH_SIZE} dòng)...`);

  for (let i = 0; i < totalBatches; i++) {
    const startIdx = i * BATCH_SIZE;
    const endIdx = Math.min((i + 1) * BATCH_SIZE, totalDataRows);
    const batchRows = rows.slice(startIdx, endIdx);
    
    // First batch uses requested mode ('replace' to clear old rows for date), subsequent batches use 'append'
    const currentMode = (i === 0) ? mode : 'append';
    const isLastBatch = (i === totalBatches - 1);
    const payloadData = [header, ...batchRows];
    
    const payload = {
      sheetName: sheetName,
      mode: currentMode,
      data: payloadData,
      isLastBatch: isLastBatch
    };

    let success = false;
    let attempt = 0;
    const maxAttempts = 3;
    let lastError = null;

    while (!success && attempt < maxAttempts) {
      attempt++;
      try {
        console.log(`Dang gui đot ${i + 1}/${totalBatches} (${batchRows.length} dòng)...`);
        
        const response = await fetch(webAppUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(300000) // 5 minutes timeout per batch
        });

        const text = await response.text();
        if (!text.includes('SUCCESS')) {
          const cleanText = text.length > 300 ? text.substring(0, 300) + '...' : text;
          throw new Error(`Google Apps Script khong tra ve SUCCESS. Chi tiet: ${cleanText}`);
        }

        console.log(`  ✓ Đot ${i + 1}/${totalBatches} thanh cong!`);
        success = true;
        await new Promise(resolve => setTimeout(resolve, 1500));
        break;
      } catch (err) {
        lastError = err;
        console.error(`  ✕ Loi o đot ${i + 1}/${totalBatches} (lan ${attempt}): ${err.message}`);
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    if (!success) {
      throw new Error(`That bai hoan toan o đot ${i + 1} sau ${maxAttempts} lan thu. Loi cuoi: ${lastError ? lastError.message : 'Unknown'}`);
    }
  }

  console.log('=== GOOGLE SHEETS UPLOAD ALL BATCHES SUCCESSFUL ===\n');
}

upload().catch(err => {
  console.error('\n=== GOOGLE SHEETS UPLOAD ERROR ===');
  console.error(err.message);
  process.exit(1);
});
