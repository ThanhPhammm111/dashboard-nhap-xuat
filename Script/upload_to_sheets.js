const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Configuration
const keyPath = path.join(__dirname, 'service_account.json');
const csvPath = process.argv[2] || 'C:\\temp_restore\\clean_kfm.csv';
const spreadsheetId = '1PbJeGNX5GRz6vCdEnzhVQ439Y2JWYvWBicrxgV72Xlo';
const sheetName = 'DATA Thực xuất';

if (!fs.existsSync(keyPath)) {
  console.error('\n=== GOOGLE SHEETS UPLOAD FAILED ===');
  console.error(`Loi: Khong tim thay file ${keyPath}`);
  console.error('Vui long tao va dat file service_account.json vao thu muc Script theo huong dan.');
  process.exit(1);
}

if (!fs.existsSync(csvPath)) {
  console.error('\n=== GOOGLE SHEETS UPLOAD FAILED ===');
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
  const values = parseCsv(csvContent);

  if (values.length <= 1) {
    console.log('Khong co du lieu thuc te nao de day len Sheet (chi co dong Tieu de). Bo qua.');
    return;
  }

  console.log('Ket noi den Google Sheets API...');
  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  
  const sheets = google.sheets({ version: 'v4', auth });

  // Check if the target sheet already has data (headers or rows)
  console.log(`Kiem tra trang thai trang tinh [${sheetName}]...`);
  let hasData = false;
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:B2`,
    });
    hasData = response.data.values && response.data.values.length > 0;
  } catch (err) {
    console.log(`Khong the doc du lieu kiem tra (co the Sheet rong). Thu tu dong tao moi.`);
  }

  // If sheet has data, skip appending the header row (row index 0)
  const dataToAppend = hasData ? values.slice(1) : values;

  console.log(`Dang add va ghi them (append) ${dataToAppend.length} dong vao [${sheetName}]...`);
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    resource: {
      values: dataToAppend
    }
  });

  console.log('=== GOOGLE SHEETS UPLOAD SUCCESSFUL ===\n');
}

upload().catch(err => {
  console.error('\n=== GOOGLE SHEETS UPLOAD ERROR ===');
  console.error(err.message);
  process.exit(1);
});
