const fs = require('fs');
const path = require('path');

// Configuration
const csvPath = process.argv[2] || 'C:\\temp_restore\\clean_kfm.csv';
const webAppUrl = 'https://script.google.com/macros/s/AKfycbzaVLooO814joo92lj9Bt4eQ4UGCJ52o0SpdwSzds_jN6P1hpsf9-oJRRc0e_4JIZ2fZg/exec';

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

  const payload = {
    sheetName: process.argv[3] || 'DATA Thực xuất',
    data: data
  };

  console.log(`Dang gui du lieu len Google Sheets [Tab: ${payload.sheetName}] qua Apps Script...`);
  const response = await fetch(webAppUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
 
   const text = await response.text();
   console.log(`Ket qua phan hoi tu Google Apps Script: ${text}`);
 
   if (text.includes('SUCCESS')) {
     console.log('=== GOOGLE SHEETS UPLOAD SUCCESSFUL ===\n');
   } else {
     throw new Error(`Google Apps Script khong tra ve SUCCESS. Chi tiet: ${text}`);
   }
 }

upload().catch(err => {
  console.error('\n=== GOOGLE SHEETS UPLOAD ERROR ===');
  console.error(err.message);
  process.exit(1);
});
