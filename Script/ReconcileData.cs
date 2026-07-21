using System;
using System.IO;
using System.Collections.Generic;
using System.Text;
using System.Linq;
using System.Net;
using System.IO.Compression;
using System.Xml;

namespace ReconcileData
{
    class Program
    {
        static void Main(string[] args)
        {
            System.Threading.Thread.CurrentThread.CurrentCulture = System.Globalization.CultureInfo.InvariantCulture;
            System.Threading.Thread.CurrentThread.CurrentUICulture = System.Globalization.CultureInfo.InvariantCulture;

            if (args.Length == 2 && args[0] == "--upload-only")
            {
                string targetKfm = args[1];
                if (!File.Exists(targetKfm))
                {
                    Console.WriteLine("File KFM khong ton tai tai: " + targetKfm);
                    return;
                }

                string kfmDateStr = ExtractDate(targetKfm);
                if (string.IsNullOrEmpty(kfmDateStr))
                {
                    Console.WriteLine("Khong the trich xuat ngay tu ten file KFM: " + Path.GetFileName(targetKfm));
                    return;
                }

                string rootDir = Path.GetDirectoryName(Path.GetDirectoryName(Path.GetDirectoryName(targetKfm)));
                string dateStamp = DateTime.Now.ToString("yyyy-MM-dd");
                DateTime parsed = ParseDateStr(kfmDateStr);
                if (parsed != DateTime.MinValue)
                {
                    dateStamp = parsed.ToString("yyyy-MM-dd");
                }
                
                string archiveDir = Path.Combine(rootDir, "Archive", dateStamp);
                if (!Directory.Exists(archiveDir)) Directory.CreateDirectory(archiveDir);
                string archiveFile = Path.Combine(archiveDir, Path.GetFileName(targetKfm));

                Console.WriteLine("====================================================");
                Console.WriteLine("CHE DO DIRECT UPLOAD ONLY (KHONG DOI SOAT)");
                Console.WriteLine("File nguon KFM: " + Path.GetFileName(targetKfm));
                Console.WriteLine("Ngay KFM: " + FormatDate(kfmDateStr));
                Console.WriteLine("File luu tru: " + archiveFile);
                Console.WriteLine("====================================================");

                try
                {
                    CleanAndArchiveKfm(targetKfm, archiveFile, kfmDateStr);
                    Console.WriteLine("Da loc, luu tru va chuan bi file CSV tam thoi de upload Sheets xong!");
                }
                catch (Exception ex)
                {
                    Console.WriteLine("Loi khi thuc hien loc: " + ex.Message);
                    Console.WriteLine(ex.StackTrace);
                }
                return;
            }

            if (args.Length < 4)
            {
                Console.WriteLine("Usage: ReconcileData.exe <DataST.xlsx/csv> <KFM.xlsx/csv> <ABA.xlsx/csv> <Result.csv>");
                return;
            }

            string dataStFile = ResolveLatestFile(args[0], "*.xlsx");
            string kfmFile = ResolveLatestFile(args[1], "*.xlsx");
            string abaFile = ResolveLatestFile(args[2], "*.xlsx");
            string outFile = args[3];
            string telegramToken = args.Length > 4 ? args[4] : "";
            string telegramChatId = args.Length > 5 ? args[5] : "";

            if (string.IsNullOrEmpty(dataStFile)) { Console.WriteLine("Khong tim thay file DATA ST!"); return; }
            if (string.IsNullOrEmpty(kfmFile)) { Console.WriteLine("Khong tim thay file KFM!"); return; }
            if (string.IsNullOrEmpty(abaFile)) { Console.WriteLine("Khong tim thay file ABA!"); return; }

            Console.WriteLine("Su dung file DATA ST: " + Path.GetFileName(dataStFile));
            Console.WriteLine("Su dung file KFM: " + Path.GetFileName(kfmFile));
            Console.WriteLine("Su dung file ABA: " + Path.GetFileName(abaFile));

            try
            {
                // Date check
                string kfmDateStr = ExtractDate(kfmFile);
                string abaDateStr = ExtractDate(abaFile);
                bool dateMismatch = false;
                if (!string.IsNullOrEmpty(kfmDateStr) && !string.IsNullOrEmpty(abaDateStr) && kfmDateStr != abaDateStr)
                {
                    dateMismatch = true;
                    Console.ForegroundColor = ConsoleColor.Yellow;
                    Console.WriteLine("\n==================================================================");
                    Console.WriteLine("CANH BAO: Ngay cua file KFM (" + FormatDate(kfmDateStr) + ") va file ABA (" + FormatDate(abaDateStr) + ") KHONG KHOP NHAU!");
                    Console.WriteLine("Dieu nay co the lam cho ket qua doi soat bi lech rat nhieu.");
                    Console.WriteLine("Vui long kiem tra lai cac file trong thu muc Data.");
                    Console.WriteLine("==================================================================\n");
                    Console.ResetColor();
                }
                // 1. Load Data ST mapping
                Console.WriteLine("Doc file DATA ST...");
                var stData = ReadExcelOrCsv(dataStFile);
                if (stData.Count < 2) throw new Exception("DATA ST file is empty or missing headers.");
                
                int stColName = FindCol(stData[0], new[] { "Nơi nhận", "Noi nhan" });
                int stColAbbr = FindCol(stData[0], new[] { "viết tắt", "viet tat" });
                if (stColName == -1) stColName = 0;
                if (stColAbbr == -1) stColAbbr = 1;

                var stMapping = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                for (int i = 1; i < stData.Count; i++)
                {
                    var row = stData[i];
                    if (row.Length > Math.Max(stColName, stColAbbr))
                    {
                        string name = row[stColName].Trim();
                        string abbr = row[stColAbbr].Trim();
                        if (!string.IsNullOrEmpty(name))
                        {
                            stMapping[name] = abbr;
                        }
                    }
                }

                // 2. Load KFM data
                Console.WriteLine("Doc file KFM...");
                var kfmData = ReadExcelOrCsv(kfmFile);
                if (kfmData.Count < 2) throw new Exception("KFM file is empty or missing headers.");
                
                int kfmColBranch = FindCol(kfmData[0], new[] { "Chi nhánh nhận", "Chi nhanh nhan" });
                int kfmColProduct = FindCol(kfmData[0], new[] { "Mã hàng", "Ma hang", "SKU" });
                int kfmColQty = FindCol(kfmData[0], new[] { "Số lượng chuyển", "So luong chuyen", "Số lượng", "So luong" });
                int kfmColDate = FindCol(kfmData[0], new[] { "Ngày chuyển hàng", "Ngay chuyen hang", "Ngày tạo", "Ngay tao", "Ngày chuyển", "Ngay chuyen" });
                
                // Fallbacks based on structure
                if (kfmColBranch == -1) kfmColBranch = 3;
                if (kfmColProduct == -1) kfmColProduct = 7;
                int kfmColProductName = FindCol(kfmData[0], new[] { "Tên hàng", "Ten hang" });
                if (kfmColQty == -1) kfmColQty = 10;
                if (kfmColProductName == -1) kfmColProductName = 8;
                if (kfmColDate == -1) kfmColDate = 0;

                // kfmDict: Key -> Total Qty
                var kfmDict = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
                var productNameDict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                var productCategoryDict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                var productLoaiHangDict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                
                string currentSlipDate = "";
                for (int i = 1; i < kfmData.Count; i++)
                {
                    var row = kfmData[i];
                    if (row.Length > Math.Max(kfmColBranch, Math.Max(kfmColProduct, kfmColQty)))
                    {
                        // Keep track of date (handling merged cells/grouping)
                        if (row.Length > kfmColDate)
                        {
                            string dVal = row[kfmColDate].Trim();
                            if (!string.IsNullOrEmpty(dVal))
                            {
                                var dMatch = System.Text.RegularExpressions.Regex.Match(dVal, @"\d{2}/\d{2}/\d{4}");
                                if (dMatch.Success)
                                {
                                    currentSlipDate = dMatch.Value.Replace("/", "");
                                }
                                else
                                {
                                    var dMatch2 = System.Text.RegularExpressions.Regex.Match(dVal, @"\d{4}-\d{2}-\d{2}");
                                    if (dMatch2.Success)
                                    {
                                        string[] p = dMatch2.Value.Split('-');
                                        currentSlipDate = p[2] + p[1] + p[0];
                                    }
                                }
                            }
                        }

                        // Date filter to ensure we only count target date if filename has a date
                        if (!string.IsNullOrEmpty(kfmDateStr) && !string.IsNullOrEmpty(currentSlipDate) && currentSlipDate != kfmDateStr)
                        {
                            continue;
                        }

                        string branch = row[kfmColBranch].Trim();
                        string product = row[kfmColProduct].Trim();
                        string qtyStr = row[kfmColQty].Trim().Replace(",", "");
                        string productName = (row.Length > kfmColProductName) ? row[kfmColProductName].Trim() : "";

                        // Filter out products starting with 'C' (case-insensitive)
                        if (product.StartsWith("C", StringComparison.OrdinalIgnoreCase))
                        {
                            continue;
                        }

                        // Map branch name to ST abbreviation
                        string stAbbr = branch; // Default to original if not found
                        if (stMapping.ContainsKey(branch))
                        {
                            stAbbr = stMapping[branch];
                        }

                        string key = stAbbr + "_" + product; // Use underscore as separator for clarity
                        
                        decimal qty = 0;
                        if (decimal.TryParse(qtyStr, out qty))
                        {
                            qty = Math.Round(qty, 4);
                        }

                        if (!string.IsNullOrEmpty(productName) && !productNameDict.ContainsKey(product))
                            productNameDict[product] = productName;

                        if (kfmDict.ContainsKey(key))
                            kfmDict[key] += qty;
                        else
                            kfmDict[key] = qty;
                    }
                }

                // 3. Load ABA data
                Console.WriteLine("Doc file ABA...");
                var abaData = ReadExcelOrCsv(abaFile);
                if (abaData.Count < 2) throw new Exception("ABA file is empty or missing headers.");
                
                int abaColST = FindCol(abaData[0], new[] { "Mã CH", "Ma CH" });
                int abaColProduct = FindCol(abaData[0], new[] { "Mã SP", "Ma SP" });
                int abaColQty = FindCol(abaData[0], new[] { "Số lượng giao", "So luong giao" });

                int abaColProductName = FindCol(abaData[0], new[] { "Tên SP", "Ten SP" });
                int abaColCategory = FindCol(abaData[0], new[] { "Category" });
                int abaColLoaiHang = FindCol(abaData[0], new[] { "Loại hàng", "Loai hang" });
                
                if (abaColST == -1) abaColST = 1;
                if (abaColProduct == -1) abaColProduct = 5;
                if (abaColQty == -1) abaColQty = 9;
                if (abaColProductName == -1) abaColProductName = 6;
                if (abaColCategory == -1) abaColCategory = 17;
                if (abaColLoaiHang == -1) abaColLoaiHang = 16;

                // abaDict: Key -> Total Qty
                var abaDict = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
                
                for (int i = 1; i < abaData.Count; i++)
                {
                    var row = abaData[i];
                    if (row.Length > Math.Max(abaColST, Math.Max(abaColProduct, abaColQty)))
                    {
                        string stCode = row[abaColST].Trim();
                        string product = row[abaColProduct].Trim();
                        string qtyStr = row[abaColQty].Trim().Replace(",", "");
                        string productName = (row.Length > abaColProductName) ? row[abaColProductName].Trim() : "";
                        string category = (row.Length > abaColCategory) ? NormalizeCategory(row[abaColCategory]) : "";
                        string loaiHang = (abaColLoaiHang != -1 && row.Length > abaColLoaiHang) ? NormalizeCategory(row[abaColLoaiHang]) : "";

                        string key = stCode + "_" + product;

                        decimal qty = 0;
                        if (decimal.TryParse(qtyStr, out qty))
                        {
                            qty = Math.Round(qty, 4);
                        }

                        if (!string.IsNullOrEmpty(productName) && !productNameDict.ContainsKey(product))
                            productNameDict[product] = productName;
                            
                        if (!string.IsNullOrEmpty(category) && !productCategoryDict.ContainsKey(product))
                            productCategoryDict[product] = category;

                        if (!string.IsNullOrEmpty(loaiHang) && !productLoaiHangDict.ContainsKey(product))
                            productLoaiHangDict[product] = loaiHang;

                        if (abaDict.ContainsKey(key))
                            abaDict[key] += qty;
                        else
                            abaDict[key] = qty;
                    }
                }

                // 4. Reconcile
                Console.WriteLine("Dang doi soat du lieu...");
                var allKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var k in kfmDict.Keys) allKeys.Add(k);
                foreach (var k in abaDict.Keys) allKeys.Add(k);

                var allStSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var key in allKeys) {
                    var p = key.Split('_');
                    if (p.Length > 0 && !string.IsNullOrEmpty(p[0])) allStSet.Add(p[0]);
                }

                var results = new List<string[]>();
                var stLechList = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                var warningDict = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
                var dsChuaCoPhieu = new List<string[]>();
                var dsDaCoPhieuLech = new List<string[]>();
                
                // Header (Added column Loại chênh lệch)
                results.Add(new[] { "Key (ST_Code)", "ST Code / Abbr", "Product Code", "Product Name", "Category", "Loai Hang", "KFM Qty (SL Chuyen)", "ABA Qty (SL Giao)", "Diff (Lech)", "Loai Chenh Lech" });

                foreach (var key in allKeys)
                {
                    decimal kfmQty = kfmDict.ContainsKey(key) ? kfmDict[key] : 0;
                    decimal abaQty = abaDict.ContainsKey(key) ? abaDict[key] : 0;
                    decimal diff = kfmQty - abaQty;

                    if (diff == 0) continue;

                    var parts = key.Split('_');
                    string st = parts.Length > 0 ? parts[0] : "";
                    string prod = parts.Length > 1 ? parts[1] : "";
                    
                    string prodName = productNameDict.ContainsKey(prod) ? productNameDict[prod] : "";
                    string prodCategory = productCategoryDict.ContainsKey(prod) ? productCategoryDict[prod] : "";
                    string prodLoaiHang = productLoaiHangDict.ContainsKey(prod) ? productLoaiHangDict[prod] : "";
                    string prodTextFormat = "=\"" + prod + "\"";
                    
                    string diffType = kfmQty == 0 ? "Chưa tạo phiếu KFM" : "Đã tạo phiếu KFM (Lệch số lượng)";

                    if (!string.IsNullOrEmpty(st)) {
                        stLechList.Add(st);
                        string catInfo = string.IsNullOrEmpty(prodCategory) ? prodLoaiHang : prodCategory;
                        if (string.IsNullOrEmpty(catInfo)) catInfo = "Khong xac dinh";
                        
                        string wKey = st + "|" + catInfo;
                        if (warningDict.ContainsKey(wKey)) warningDict[wKey] += diff;
                        else warningDict[wKey] = diff;

                        var itemDetails = new[] { st, prod, prodName, catInfo, kfmQty.ToString(), abaQty.ToString(), diff.ToString() };
                        if (kfmQty == 0) {
                            dsChuaCoPhieu.Add(itemDetails);
                        } else {
                            dsDaCoPhieuLech.Add(itemDetails);
                        }
                    }

                    results.Add(new[] { 
                        key, 
                        st, 
                        prodTextFormat, 
                        prodName,
                        prodCategory,
                        prodLoaiHang,
                        kfmQty.ToString(), 
                        abaQty.ToString(), 
                        diff.ToString(),
                        diffType
                    });
                }

                // 5. Output
                Console.WriteLine("Luu ket qua vao file: " + outFile);
                string outDir = Path.GetDirectoryName(outFile);
                if (!Directory.Exists(outDir)) Directory.CreateDirectory(outDir);

                WriteCsv(outFile, results);
                
                // Write daily Result_[date].csv
                try {
                    string dailyOutFile = Path.Combine(outDir, "Result_" + kfmDateStr + ".csv");
                    WriteCsv(dailyOutFile, results);
                    Console.WriteLine("Da ghi file ket qua theo ngay: " + Path.GetFileName(dailyOutFile));
                } catch (Exception dailyEx) {
                    Console.WriteLine("Loi khi ghi file ket qua theo ngay: " + dailyEx.Message);
                }
                
                // Tao HTML Report
                string htmlFile = Path.Combine(outDir, "BaoCao_CanhBao.html");
                StringBuilder html = new StringBuilder();
                html.AppendLine(@"<!DOCTYPE html>
<html lang=""vi"">
<head>
    <meta charset=""UTF-8"">
    <title>Báo Cáo Đối Soát Dữ Liệu</title>
    <link href=""https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap"" rel=""stylesheet"">
    <style>
        :root { --primary: #3b82f6; --danger: #ef4444; --success: #10b981; --dark: #1e293b; --light: #f8fafc; }
        body { 
            font-family: 'Outfit', sans-serif; 
            background: linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 100%); 
            color: var(--dark); 
            margin: 0; 
            padding: 40px 20px;
            min-height: 100vh;
        }
        .container { 
            max-width: 900px; 
            margin: auto; 
            background: rgba(255, 255, 255, 0.95); 
            backdrop-filter: blur(10px); 
            padding: 50px; 
            border-radius: 24px; 
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.15); 
            animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes slideUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }
        h1 { 
            text-align: center; 
            font-size: 2.8rem; 
            font-weight: 800; 
            margin-top: 0;
            margin-bottom: 40px;
            background: linear-gradient(90deg, #1e40af, #3b82f6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
            margin-bottom: 40px;
        }
        .stat-card {
            background: #fff;
            padding: 24px;
            border-radius: 16px;
            text-align: center;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
            border: 1px solid #e2e8f0;
        }
        .stat-card.danger { border-bottom: 5px solid var(--danger); }
        .stat-card.primary { border-bottom: 5px solid var(--primary); }
        .stat-val { font-size: 3.5rem; font-weight: 800; margin: 10px 0; line-height: 1; }
        .danger .stat-val { color: var(--danger); }
        .primary .stat-val { color: var(--primary); }
        .stat-label { font-size: 1rem; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; }
        
        .section-title {
            font-size: 1.6rem;
            font-weight: 800;
            margin: 40px 0 20px 0;
            color: #334155;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .warning-list {
            list-style: none; padding: 0; margin: 0;
            display: grid; gap: 12px;
        }
        .warning-item {
            background: #fef2f2;
            border-left: 6px solid var(--danger);
            padding: 16px 20px;
            border-radius: 10px;
            font-size: 1.1rem;
            color: #991b1b;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.02);
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .warning-item:hover { transform: translateX(5px); box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .qty-badge {
            background: var(--danger);
            color: white;
            padding: 6px 14px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 0.95rem;
            box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3);
        }
        
        .st-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
            gap: 12px;
        }
        .st-tag {
            background: #f1f5f9;
            color: #334155;
            padding: 12px;
            border-radius: 10px;
            text-align: center;
            font-weight: 800;
            font-size: 1.1rem;
            border: 1px solid #e2e8f0;
            transition: all 0.2s;
        }
        .st-tag:hover { background: #e2e8f0; transform: translateY(-2px); }
        .success-banner {
            background: #ecfdf5;
            color: #065f46;
            padding: 24px;
            border-radius: 12px;
            text-align: center;
            font-weight: 800;
            font-size: 1.3rem;
            border: 1px solid #a7f3d0;
            box-shadow: 0 4px 6px rgba(16, 185, 129, 0.1);
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            margin-bottom: 30px;
            background: #fff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.02);
            border: 1px solid #e2e8f0;
        }
        th, td {
            padding: 12px 16px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
            font-size: 0.9rem;
        }
        th {
            background-color: #f8fafc;
            color: #475569;
            font-weight: 800;
            text-transform: uppercase;
            font-size: 0.75rem;
            letter-spacing: 0.5px;
        }
        tr:hover { background-color: #f8fafc; }
        .text-right { text-align: right; }
    </style>
</head>
<body>
    <div class=""container"">
        <h1>📊 BÁO CÁO ĐỐI SOÁT XUẤT HÀNG</h1>");

                if (dateMismatch)
                {
                    html.AppendLine(@"<div class=""success-banner"" style=""background: #fffbeb; border: 1px solid #fef3c7; color: #b45309; margin-bottom: 24px; font-size: 1.1rem; line-height: 1.5; text-align: left; font-weight: normal;"">
                        ⚠️ <b>CẢNH BÁO LỆCH NGÀY DỮ LIỆU:</b><br>
                        - File KFM ngày: <b>" + FormatDate(kfmDateStr) + @"</b> (" + Path.GetFileName(kfmFile) + @")<br>
                        - File ABA ngày: <b>" + FormatDate(abaDateStr) + @"</b> (" + Path.GetFileName(abaFile) + @")<br>
                        Ngày của hai file không khớp nhau. Kết quả đối soát dưới đây có thể bị lệch rất nhiều do so sánh chênh lệch giữa hai ngày khác nhau.
                    </div>");
                }

                html.AppendLine(@"
        <div class=""stats-grid"">
            <div class=""stat-card primary"">
                <div class=""stat-label"">Tổng Siêu Thị Tham Gia</div>
                <div class=""stat-val"">" + allStSet.Count + @"</div>
            </div>
            <div class=""stat-card danger"">
                <div class=""stat-label"">Siêu Thị Thiếu Phiếu</div>
                <div class=""stat-val"">" + stLechList.Count + @"</div>
            </div>
        </div>");

                html.AppendLine(@"<div class=""section-title"">🚨 Chi Tiết Cảnh Báo Lệch Nhóm Hàng</div>");
                
                var formattedWarnings = new List<string>();
                if (warningDict.Count == 0) {
                    html.AppendLine(@"<div class=""success-banner"">✨ TUYỆT VỜI! 100% Khớp Số Liệu. Không Phát Hiện Thiếu Phiếu!</div>");
                } else {
                    html.AppendLine(@"<ul class=""warning-list"">");
                    foreach(var kvp in warningDict.OrderBy(x => x.Key)) {
                        var wparts = kvp.Key.Split('|');
                        string sw = wparts[0];
                        string cw = wparts[1];
                        string wMsg = string.Format("=> CANH BAO: Chi nhanh [{0}] dang lech hang '{1}' (Tong so luong lech: {2})", sw, cw, kvp.Value);
                        formattedWarnings.Add(wMsg);
                        
                        html.AppendLine(string.Format(@"<li class=""warning-item"">
                            <span>Chi nhánh <b>{0}</b> lệch nhóm hàng <b>{1}</b></span>
                            <span class=""qty-badge"">Lệch {2}</span>
                        </li>", sw, cw, kvp.Value));
                    }
                    html.AppendLine(@"</ul>");
                }

                if (dsDaCoPhieuLech.Count > 0)
                {
                    html.AppendLine(@"<div class=""section-title"">⚠️ Chi Tiết Mã Đã Có Phiếu KFM Nhưng Lệch Số Lượng (" + dsDaCoPhieuLech.Count + @")</div>");
                    html.AppendLine(@"<table>");
                    html.AppendLine(@"<thead><tr><th>Siêu thị</th><th>Mã sản phẩm</th><th>Tên sản phẩm</th><th>Nhóm</th><th class=""text-right"">SL KFM</th><th class=""text-right"">SL ABA</th><th class=""text-right"">Chênh lệch</th></tr></thead>");
                    html.AppendLine(@"<tbody>");
                    foreach (var row in dsDaCoPhieuLech.OrderBy(x => x[0]).ThenBy(x => x[1]))
                    {
                        decimal kfm = decimal.Parse(row[4]);
                        decimal aba = decimal.Parse(row[5]);
                        decimal diff = decimal.Parse(row[6]);
                        html.AppendLine(string.Format(@"<tr><td><b>{0}</b></td><td><code>{1}</code></td><td>{2}</td><td>{3}</td><td class=""text-right"">{4:N0}</td><td class=""text-right"">{5:N0}</td><td class=""text-right"" style=""color: {7}; font-weight: bold;"">{6:+0;-0;0}</td></tr>",
                            row[0], row[1], row[2], row[3], kfm, aba, diff, diff > 0 ? "var(--success)" : "var(--danger)"));
                    }
                    html.AppendLine(@"</tbody>");
                    html.AppendLine(@"</table>");
                }

                if (dsChuaCoPhieu.Count > 0)
                {
                    html.AppendLine(@"<div class=""section-title"">❌ Chi Tiết Mã Chưa Tạo Phiếu KFM (" + dsChuaCoPhieu.Count + @")</div>");
                    html.AppendLine(@"<table>");
                    html.AppendLine(@"<thead><tr><th>Siêu thị</th><th>Mã sản phẩm</th><th>Tên sản phẩm</th><th>Nhóm</th><th class=""text-right"">SL KFM</th><th class=""text-right"">SL ABA</th><th class=""text-right"">Chênh lệch</th></tr></thead>");
                    html.AppendLine(@"<tbody>");
                    foreach (var row in dsChuaCoPhieu.OrderBy(x => x[0]).ThenBy(x => x[1]))
                    {
                        decimal kfm = decimal.Parse(row[4]);
                        decimal aba = decimal.Parse(row[5]);
                        decimal diff = decimal.Parse(row[6]);
                        html.AppendLine(string.Format(@"<tr><td><b>{0}</b></td><td><code>{1}</code></td><td>{2}</td><td>{3}</td><td class=""text-right"">{4:N0}</td><td class=""text-right"">{5:N0}</td><td class=""text-right"" style=""color: var(--danger); font-weight: bold;"">{6:+0;-0;0}</td></tr>",
                            row[0], row[1], row[2], row[3], kfm, aba, diff));
                    }
                    html.AppendLine(@"</tbody>");
                    html.AppendLine(@"</table>");
                }

                html.AppendLine(@"<div class=""section-title"">🏢 Danh Sách Nhanh ST Lệch</div>");
                if (stLechList.Count == 0) {
                    html.AppendLine(@"<div>Không có dữ liệu lệch.</div>");
                } else {
                    html.AppendLine(@"<div class=""st-grid"">");
                    foreach(var s in stLechList.OrderBy(x => x)) {
                        html.AppendLine(string.Format(@"<div class=""st-tag"">{0}</div>", s));
                    }
                    html.AppendLine(@"</div>");
                }
                
                html.AppendLine(@"
    </div>
</body>
</html>");
                File.WriteAllText(htmlFile, html.ToString(), Encoding.UTF8);
                
                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine("-------------------------------------------------");
                Console.WriteLine("Doi soat thanh cong!");
                Console.WriteLine("Phat hien {0} / {1} chi nhanh (ST) bi lech so lieu.", stLechList.Count, allStSet.Count);
                Console.ResetColor();
                
                // In truc tiep canh bao ra man hinh den voi mau DO
                Console.WriteLine("");
                Console.ForegroundColor = ConsoleColor.Red;
                foreach(var w in formattedWarnings) {
                    Console.WriteLine(w);
                }
                Console.ResetColor();
                
                Console.WriteLine("");
                Console.ForegroundColor = ConsoleColor.Cyan;
                Console.WriteLine("Bao cao mau sac da duoc luu tai: BaoCao_CanhBao.html");
                Console.WriteLine("-------------------------------------------------");
                Console.ResetColor();

                // 6. Gui Telegram
                if (!string.IsNullOrEmpty(telegramToken) && !string.IsNullOrEmpty(telegramChatId))
                {
                    Console.WriteLine("");
                                       var tgMsg = new StringBuilder();
                    tgMsg.AppendLine("🔔 <b>BÁO CÁO ĐỐI SOÁT XUẤT HÀNG</b>");
                    tgMsg.AppendLine(string.Format("📅 Ngày đối soát: <b>{0}</b>", FormatDate(kfmDateStr)));
                    tgMsg.AppendLine(string.Format("📊 Tổng siêu thị tham gia: <b>{0}</b>", allStSet.Count));

                    if (stLechList.Count == 0) {
                        tgMsg.AppendLine("\n✅ <i>Tuyệt vời! 100% khớp số liệu.</i>");
                    } else {
                        var meatStSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                        var frozenStSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                        foreach (var kvp in warningDict)
                        {
                            var wparts = kvp.Key.Split('|');
                            string sw = wparts[0];
                            string cw = wparts[1];
                            if (cw.ToLower().Contains("meat")) meatStSet.Add(sw);
                            else if (cw.ToLower().Contains("frozen")) frozenStSet.Add(sw);
                        }

                        decimal totalDiff = 0;
                        foreach (var r in results.Skip(1))
                        {
                            decimal dVal = 0;
                            decimal.TryParse(r[8], out dVal);
                            totalDiff += Math.Abs(dVal);
                        }

                        tgMsg.AppendLine(string.Format("⚠️ <b>Siêu thị bị lệch: {0} CH</b> (Tổng lệch: <b>{1:N0}</b>)", stLechList.Count, totalDiff));
                        tgMsg.AppendLine("");
                        tgMsg.AppendLine(string.Format("🥩 Lệch hàng MEAT: <b>{0} CH</b>", meatStSet.Count));
                        tgMsg.AppendLine(string.Format("❄️ Lệch hàng FROZEN: <b>{0} CH</b>", frozenStSet.Count));
                        tgMsg.AppendLine("-------------------------------------------------");
                    }
                    
                    if (stLechList.Count > 0) {
                        tgMsg.AppendLine("\n📋 <b>Danh sách ST lệch:</b> " + string.Join(", ", stLechList.OrderBy(x => x)));
                        tgMsg.AppendLine("\n🔗 <b>Chi tiết đối soát xem tại Dashboard:</b>");
                        tgMsg.AppendLine("https://thanhphammm111.github.io/transport_daily_report/external/doi_soat/");
                    }

                    var ids = telegramChatId.Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries);
                    bool atLeastOneSent = false;
                    foreach (var id in ids) {
                        try {
                            SendTelegramMessage(telegramToken, id.Trim(), tgMsg.ToString());
                            atLeastOneSent = true;
                            Console.ForegroundColor = ConsoleColor.Green;
                            Console.WriteLine("Da gui bao cao Telegram den ID " + id.Trim() + " thanh cong!");
                            Console.ResetColor();
                        } catch (Exception texc) {
                            Console.ForegroundColor = ConsoleColor.Red;
                            Console.WriteLine("Loi gui Telegram den ID " + id.Trim() + ": " + texc.Message);
                            if (texc.Message.Contains("403")) {
                                Console.WriteLine("-> Luu y: Bot co the da bi kick khoi nhom hoac bi chan chat.");
                            }
                            Console.ResetColor();
                        }
                    }
                    if (atLeastOneSent) {
                        Console.ForegroundColor = ConsoleColor.Green;
                        Console.WriteLine("Da hoan thanh gui bao cao den cac kenh Telegram kha dung!");
                        Console.ResetColor();
                    }
                }

                // Copy to fixed filenames and Archive raw files
                try
                {
                    string rootDir = Path.GetDirectoryName(Path.GetDirectoryName(outFile)); // Parent of Output is root
                    
                    string dataStTarget = Path.Combine(rootDir, @"Data\Data ST\DATA ST.xlsx");
                    string kfmTarget = Path.Combine(rootDir, @"Data\KFM\KFM.xlsx");
                    string abaTarget = Path.Combine(rootDir, @"Data\ABA\ABA.xlsx");

                    // Copy ST
                    if (Path.GetFullPath(dataStFile) != Path.GetFullPath(dataStTarget))
                    {
                        File.Copy(dataStFile, dataStTarget, true);
                    }
                    // Copy KFM
                    if (Path.GetFullPath(kfmFile) != Path.GetFullPath(kfmTarget))
                    {
                        File.Copy(kfmFile, kfmTarget, true);
                    }
                    // Copy ABA
                    if (Path.GetFullPath(abaFile) != Path.GetFullPath(abaTarget))
                    {
                        File.Copy(abaFile, abaTarget, true);
                    }

                    // Archive KFM (Clean columns if 100% match)
                    string dateStamp = DateTime.Now.ToString("yyyy-MM-dd");
                    string archiveDir = Path.Combine(rootDir, "Archive", dateStamp);
                    if (!Directory.Exists(archiveDir)) Directory.CreateDirectory(archiveDir);
                    
                    if (Path.GetFullPath(kfmFile) != Path.GetFullPath(kfmTarget) && File.Exists(kfmFile))
                    {
                        string archiveFile = Path.Combine(archiveDir, Path.GetFileName(kfmFile));
                        if (File.Exists(archiveFile)) File.Delete(archiveFile);
                        
                        if (stLechList.Count == 0)
                        {
                            Console.WriteLine("Doi soat thanh cong 100%. Dang loc cot va luu tru file KFM sach...");
                            CleanAndArchiveKfm(kfmFile, archiveFile, kfmDateStr);
                            File.Delete(kfmFile);
                        }
                        else
                        {
                            File.Move(kfmFile, archiveFile);
                        }
                        Console.WriteLine("Da luu tru file KFM: " + Path.GetFileName(kfmFile));
                    }

                    // Write status.json
                    try
                    {
                        decimal totalKfm = kfmDict.Values.Sum();
                        decimal totalAba = abaDict.Values.Sum();
                        string statusFile = Path.Combine(Path.GetDirectoryName(outFile), "status.json");
                        string dailyStatusFile = Path.Combine(Path.GetDirectoryName(outFile), "status_" + kfmDateStr + ".json");
                        string json = string.Format(
                            "{{\n  \"lastUpdated\": \"{0}\",\n  \"kfmFile\": \"{1}\",\n  \"kfmDate\": \"{2}\",\n  \"abaFile\": \"{3}\",\n  \"abaDate\": \"{4}\",\n  \"mismatchCount\": {5},\n  \"participatingStores\": {6},\n  \"resultFile\": \"Result_{7}.csv\",\n  \"totalKfmQty\": {8},\n  \"totalAbaQty\": {9}\n}}",
                            DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                            Path.GetFileName(kfmFile).Replace("\\", "\\\\").Replace("\"", "\\\""),
                            FormatDate(kfmDateStr),
                            Path.GetFileName(abaFile).Replace("\\", "\\\\").Replace("\"", "\\\""),
                            FormatDate(abaDateStr),
                            stLechList.Count,
                            allStSet.Count,
                            kfmDateStr,
                            totalKfm,
                            totalAba
                        );
                        File.WriteAllText(statusFile, json, Encoding.UTF8);
                        File.WriteAllText(dailyStatusFile, json, Encoding.UTF8);
                        Console.WriteLine("Da ghi file status va status theo ngay voi tong so luong KFM/ABA.");

                        // Generate/Update history.json dynamically
                        try
                        {
                            var statusFiles = Directory.GetFiles(Path.GetDirectoryName(outFile), "status_*.json");
                            var jsonList = new List<string>();
                            // Order by date descending by extracting YYYYMMDD for comparison
                            var sortedFiles = statusFiles.OrderByDescending(f => {
                                string fn = Path.GetFileNameWithoutExtension(f);
                                string[] parts = fn.Split('_');
                                if (parts.Length > 1 && parts[1].Length == 8) {
                                    string d = parts[1];
                                    return d.Substring(4, 4) + d.Substring(2, 2) + d.Substring(0, 2);
                                }
                                return fn;
                            });
                            
                            foreach (var f in sortedFiles)
                            {
                                jsonList.Add(File.ReadAllText(f));
                            }
                            string historyJson = "[\n" + string.Join(",\n", jsonList) + "\n]";
                            string historyFile = Path.Combine(Path.GetDirectoryName(outFile), "history.json");
                            File.WriteAllText(historyFile, historyJson, Encoding.UTF8);
                            Console.WriteLine("Da cap nhat history.json thanh cong!");
                        }
                        catch (Exception histEx)
                        {
                            Console.WriteLine("Loi khi tao history.json: " + histEx.Message);
                        }
                    }
                    catch (Exception statusEx)
                    {
                        Console.WriteLine("Loi khi ghi file status.json: " + statusEx.Message);
                    }
                }
                catch (Exception fileEx)
                {
                    Console.WriteLine("Loi khi copy/archive file: " + fileEx.Message);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("Loi: " + ex.Message);
                Console.WriteLine(ex.StackTrace);
            }
        }

        static int FindCol(string[] header, string[] keywords)
        {
            for (int i = 0; i < header.Length; i++)
            {
                foreach (var kw in keywords)
                {
                    if (header[i].IndexOf(kw, StringComparison.OrdinalIgnoreCase) >= 0)
                        return i;
                }
            }
            return -1;
        }

        static List<string[]> ReadExcelOrCsv(string file)
        {
            if (file.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase))
            {
                return ReadXlsx(file);
            }
            return ReadCsv(file);
        }

        static List<string[]> ReadCsv(string file)
        {
            var result = new List<string[]>();
            using (var reader = new StreamReader(file, Encoding.UTF8))
            {
                while (!reader.EndOfStream)
                {
                    var line = reader.ReadLine();
                    if (string.IsNullOrWhiteSpace(line)) continue;
                    result.Add(ParseCsvLine(line));
                }
            }
            return result;
        }

        static int GetColumnIndex(string cellRef)
        {
            int colIndex = 0;
            foreach (char c in cellRef)
            {
                if (char.IsLetter(c))
                {
                    colIndex = colIndex * 26 + (char.ToUpper(c) - 'A' + 1);
                }
                else
                {
                    break;
                }
            }
            return colIndex - 1;
        }

        static List<string> ReadSharedStrings(string filepath)
        {
            var sharedStrings = new List<string>();
            using (ZipArchive zip = ZipFile.OpenRead(filepath))
            {
                var sstEntry = zip.GetEntry("xl/sharedStrings.xml");
                if (sstEntry != null)
                {
                    using (var stream = sstEntry.Open())
                    using (var reader = System.Xml.XmlReader.Create(stream))
                    {
                        bool insideT = false;
                        StringBuilder sb = new StringBuilder();
                        while (reader.Read())
                        {
                            if (reader.NodeType == System.Xml.XmlNodeType.Element)
                            {
                                if (reader.Name == "si")
                                {
                                    sb.Length = 0;
                                }
                                else if (reader.Name == "t")
                                {
                                    insideT = true;
                                }
                            }
                            else if (reader.NodeType == System.Xml.XmlNodeType.Text && insideT)
                            {
                                sb.Append(reader.Value);
                            }
                            else if (reader.NodeType == System.Xml.XmlNodeType.EndElement)
                            {
                                if (reader.Name == "t")
                                {
                                    insideT = false;
                                }
                                else if (reader.Name == "si")
                                {
                                    sharedStrings.Add(sb.ToString());
                                }
                            }
                        }
                    }
                }
            }
            return sharedStrings;
        }

        static List<string[]> ReadXlsx(string filepath)
        {
            var rows = new List<string[]>();
            var sharedStrings = ReadSharedStrings(filepath);
            
            using (ZipArchive zip = ZipFile.OpenRead(filepath))
            {
                var sheetEntry = zip.GetEntry("xl/worksheets/sheet1.xml");
                if (sheetEntry == null)
                {
                    foreach (var entry in zip.Entries)
                    {
                        if (entry.FullName.StartsWith("xl/worksheets/sheet", StringComparison.OrdinalIgnoreCase))
                        {
                            sheetEntry = entry;
                            break;
                        }
                    }
                }

                if (sheetEntry != null)
                {
                    using (var stream = sheetEntry.Open())
                    using (var reader = System.Xml.XmlReader.Create(stream))
                    {
                        var currentRow = new SortedDictionary<int, string>();
                        int maxColIndex = -1;
                        string currentCellRef = null;
                        string currentCellType = null;
                        bool insideV = false;

                        while (reader.Read())
                        {
                            if (reader.NodeType == System.Xml.XmlNodeType.Element)
                            {
                                if (reader.Name == "row")
                                {
                                    currentRow.Clear();
                                    maxColIndex = -1;
                                }
                                else if (reader.Name == "c")
                                {
                                    currentCellRef = reader.GetAttribute("r");
                                    currentCellType = reader.GetAttribute("t");
                                }
                                else if (reader.Name == "v")
                                {
                                    insideV = true;
                                }
                            }
                            else if (reader.NodeType == System.Xml.XmlNodeType.Text && insideV)
                            {
                                string val = reader.Value;
                                if (currentCellType == "s")
                                {
                                    int sstIdx;
                                    if (int.TryParse(val, out sstIdx) && sstIdx >= 0 && sstIdx < sharedStrings.Count)
                                    {
                                        val = sharedStrings[sstIdx];
                                    }
                                }
                                if (currentCellRef != null)
                                {
                                    int colIndex = GetColumnIndex(currentCellRef);
                                    currentRow[colIndex] = val;
                                    if (colIndex > maxColIndex) maxColIndex = colIndex;
                                }
                            }
                            else if (reader.NodeType == System.Xml.XmlNodeType.EndElement)
                            {
                                if (reader.Name == "v")
                                {
                                    insideV = false;
                                }
                                else if (reader.Name == "row")
                                {
                                    if (maxColIndex >= 0)
                                    {
                                        string[] rowData = new string[maxColIndex + 1];
                                        for (int i = 0; i <= maxColIndex; i++)
                                        {
                                            rowData[i] = currentRow.ContainsKey(i) ? currentRow[i] : "";
                                        }
                                        rows.Add(rowData);
                                    }
                                    else
                                    {
                                        rows.Add(new string[0]);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            return rows;
        }

        static string[] ParseCsvLine(string line)
        {
            var result = new List<string>();
            bool inQuotes = false;
            var current = new StringBuilder();

            for (int i = 0; i < line.Length; i++)
            {
                char c = line[i];
                if (c == '"')
                {
                    if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
                    {
                        current.Append('"');
                        i++;
                    }
                    else
                    {
                        inQuotes = !inQuotes;
                    }
                }
                else if (c == ',' && !inQuotes)
                {
                    result.Add(current.ToString());
                    current.Clear();
                }
                else
                {
                    current.Append(c);
                }
            }
            result.Add(current.ToString());
            return result.ToArray();
        }

        static void WriteCsv(string file, List<string[]> data)
        {
            using (var writer = new StreamWriter(file, false, Encoding.UTF8))
            {
                foreach (var row in data)
                {
                    var escapedRow = row.Select(field => 
                    {
                        if (field.Contains(",") || field.Contains("\"") || field.Contains("\n"))
                        {
                            return "\"" + field.Replace("\"", "\"\"") + "\"";
                        }
                        return field;
                    });
                    writer.WriteLine(string.Join(",", escapedRow));
                }
            }
        }

        static string ResolveLatestFile(string path, string pattern)
        {
            if (File.Exists(path)) return path;
            if (Directory.Exists(path))
            {
                var files = Directory.GetFiles(path, pattern);
                if (files.Length == 0) return "";
                
                var validFiles = files.Where(f => {
                    string name = Path.GetFileName(f).ToLower();
                    return name != "kfm.xlsx" && name != "aba.xlsx" && !name.StartsWith("~$");
                }).ToList();
                
                if (validFiles.Count > 0)
                {
                    return validFiles.OrderByDescending(f => File.GetLastWriteTime(f)).FirstOrDefault();
                }
            }
            return "";
        }

        static DateTime ParseDateStr(string dateStr)
        {
            if (dateStr.Length == 8)
            {
                try
                {
                    int day = int.Parse(dateStr.Substring(0, 2));
                    int month = int.Parse(dateStr.Substring(2, 2));
                    int year = int.Parse(dateStr.Substring(4, 4));
                    return new DateTime(year, month, day);
                }
                catch
                {
                    return DateTime.MinValue;
                }
            }
            return DateTime.MinValue;
        }

        static string ExtractDate(string filepath)
        {
            string filename = Path.GetFileName(filepath);
            var match = System.Text.RegularExpressions.Regex.Match(filename, @"\d{8}");
            if (match.Success)
            {
                return match.Value;
            }
            return "";
        }

        static string FormatDate(string dateStr)
        {
            if (dateStr.Length == 8)
            {
                return dateStr.Substring(0, 2) + "/" + dateStr.Substring(2, 2) + "/" + dateStr.Substring(4, 4);
            }
            return dateStr;
        }

        static string NormalizeCategory(string val)
        {
            if (string.IsNullOrEmpty(val)) return "";
            string clean = val.Trim();
            if (string.IsNullOrEmpty(clean)) return "";
            
            string lower = clean.ToLower();
            if (lower == "f" || lower == "frozen") return "Frozen";
            if (lower == "m" || lower == "meat") return "Meat";
            
            // Standard title casing for other categories
            return char.ToUpper(lower[0]) + lower.Substring(1);
        }

        static void SendTelegramMessage(string botToken, string chatId, string message)
        {
            string url = string.Format("https://api.telegram.org/bot{0}/sendMessage", botToken);
            string postData = string.Format("chat_id={0}&text={1}&parse_mode=HTML", 
                Uri.EscapeDataString(chatId), 
                Uri.EscapeDataString(message));
            
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
            using (var client = new WebClient())
            {
                client.Headers[HttpRequestHeader.ContentType] = "application/x-www-form-urlencoded";
                client.Encoding = Encoding.UTF8;
                client.UploadString(url, postData);
            }
        }

        static void CleanAndArchiveKfm(string srcFile, string destFile, string kfmDateStr)
        {
            var kfmData = ReadExcelOrCsv(srcFile);
            if (kfmData.Count < 1) return;

            var header = kfmData[0];
            int colBranch = FindCol(header, new[] { "Chi nhánh nhận", "Chi nhanh nhan" });
            int colProduct = FindCol(header, new[] { "Mã hàng", "Ma hang", "SKU" });
            int colProductName = FindCol(header, new[] { "Tên hàng", "Ten hang" });
            int colUom = FindCol(header, new[] { "Đơn vị tính", "Don vi tinh", "Đơn vị", "Don vi" });
            int colQty = FindCol(header, new[] { "Số lượng chuyển", "So luong chuyen", "Số lượng", "So luong" });
            int colSlipCode = FindCol(header, new[] { "Mã chuyển hàng", "Ma chuyen hang", "Mã phiếu", "Ma phieu" });
            int colDate = FindCol(header, new[] { "Ngày chuyển hàng", "Ngay chuyen hang", "Ngày tạo", "Ngay tao", "Ngày chuyển", "Ngay chuyen" });
            int colCate = FindCol(header, new[] { "Nhóm hàng", "Nhom hang", "Category", "Loại hàng", "Loai hang" });

            // Fallbacks if not found
            if (colBranch == -1) colBranch = 3;
            if (colProduct == -1) colProduct = 7;
            if (colProductName == -1) colProductName = 8;
            if (colUom == -1) colUom = 9;
            if (colQty == -1) colQty = 10;
            if (colSlipCode == -1) colSlipCode = 2;
            if (colDate == -1) colDate = 0;
            if (colCate == -1) colCate = 6;

            var cleanRows = new List<string[]>();
            // Add Header (exact 8 columns in requested order)
            cleanRows.Add(new[] { "Ngày chuyển hàng", "Loại hàng", "Mã chuyển hàng", "Chi nhánh nhận", "Mã hàng", "Tên hàng", "Đơn vị tính", "Số lượng chuyển" });

            string currentSlipDate = "";
            for (int i = 1; i < kfmData.Count; i++)
            {
                var row = kfmData[i];
                if (row.Length > Math.Max(colBranch, Math.Max(colProduct, Math.Max(colProductName, Math.Max(colUom, Math.Max(colQty, Math.Max(colSlipCode, colCate)))))))
                {
                    // Date tracking (same as reconciliation to ensure we only get rows for the target date)
                    if (row.Length > colDate)
                    {
                        string dVal = row[colDate].Trim();
                        if (!string.IsNullOrEmpty(dVal))
                        {
                            var dMatch = System.Text.RegularExpressions.Regex.Match(dVal, @"\d{2}/\d{2}/\d{4}");
                            if (dMatch.Success)
                            {
                                currentSlipDate = dMatch.Value.Replace("/", "");
                            }
                            else
                            {
                                var dMatch2 = System.Text.RegularExpressions.Regex.Match(dVal, @"\d{4}-\d{2}-\d{2}");
                                if (dMatch2.Success)
                                {
                                    string[] p = dMatch2.Value.Split('-');
                                    currentSlipDate = p[2] + p[1] + p[0];
                                }
                            }
                        }
                    }

                    // Skip row if it doesn't match target date
                    if (!string.IsNullOrEmpty(kfmDateStr) && !string.IsNullOrEmpty(currentSlipDate) && currentSlipDate != kfmDateStr)
                    {
                        continue;
                    }

                    string product = row[colProduct].Trim();
                    // Skip product starting with C (case-insensitive)
                    if (product.StartsWith("C", StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    string branch = row[colBranch].Trim();
                    string productName = row[colProductName].Trim();
                    string uom = row[colUom].Trim();
                    string qty = row[colQty].Trim();
                    string slipCode = row[colSlipCode].Trim();
                    string rawCate = row[colCate].Trim();
                    string category = NormalizeCategory(rawCate);

                    string formattedDate = FormatDate(kfmDateStr);
                    cleanRows.Add(new[] { formattedDate, "", slipCode, branch, product, productName, uom, qty });
                }
            }

            // Write to new XLSX
            CreateCleanXlsx(destFile, cleanRows);

            // Write to temp CSV for Google Sheets upload
            try
            {
                string csvTemp = @"C:\temp_restore\clean_kfm.csv";
                string csvTempDir = Path.GetDirectoryName(csvTemp);
                if (!Directory.Exists(csvTempDir)) Directory.CreateDirectory(csvTempDir);
                WriteCsv(csvTemp, cleanRows);
                Console.WriteLine("Da ghi file CSV tam thoi de day Google Sheets: " + csvTemp);
            }
            catch (Exception csvEx)
            {
                Console.WriteLine("Loi khi ghi file CSV tam thoi: " + csvEx.Message);
            }
        }

        static void CreateCleanXlsx(string outPath, List<string[]> rows)
        {
            if (File.Exists(outPath)) File.Delete(outPath);
            using (ZipArchive zip = ZipFile.Open(outPath, ZipArchiveMode.Create))
            {
                // 1. [Content_Types].xml
                var entry = zip.CreateEntry("[Content_Types].xml");
                using (var sw = new StreamWriter(entry.Open(), Encoding.UTF8))
                {
                    sw.Write(@"<?xml version=""1.0"" encoding=""UTF-8"" standalone=""yes""?>
<Types xmlns=""http://schemas.openxmlformats.org/package/2006/content-types"">
  <Default Extension=""rels"" ContentType=""application/vnd.openxmlformats-package.relationships+xml""/>
  <Default Extension=""xml"" ContentType=""application/xml""/>
  <Override PartName=""/xl/workbook.xml"" ContentType=""application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml""/>
  <Override PartName=""/xl/worksheets/sheet1.xml"" ContentType=""application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml""/>
</Types>");
                }

                // 2. _rels/.rels
                entry = zip.CreateEntry("_rels/.rels");
                using (var sw = new StreamWriter(entry.Open(), Encoding.UTF8))
                {
                    sw.Write(@"<?xml version=""1.0"" encoding=""UTF-8"" standalone=""yes""?>
<Relationships xmlns=""http://schemas.openxmlformats.org/package/2006/relationships"">
  <Relationship Id=""rId1"" Type=""http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"" Target=""xl/workbook.xml""/>
</Relationships>");
                }

                // 3. xl/workbook.xml
                entry = zip.CreateEntry("xl/workbook.xml");
                using (var sw = new StreamWriter(entry.Open(), Encoding.UTF8))
                {
                    sw.Write(@"<?xml version=""1.0"" encoding=""UTF-8"" standalone=""yes""?>
<workbook xmlns=""http://schemas.openxmlformats.org/spreadsheetml/2006/main"" xmlns:r=""http://schemas.openxmlformats.org/officeDocument/2006/relationships"">
  <sheets>
    <sheet name=""Sheet1"" sheetId=""1"" r:id=""rId1""/>
  </sheets>
</workbook>");
                }

                // 4. xl/_rels/workbook.xml.rels
                entry = zip.CreateEntry("xl/_rels/workbook.xml.rels");
                using (var sw = new StreamWriter(entry.Open(), Encoding.UTF8))
                {
                    sw.Write(@"<?xml version=""1.0"" encoding=""UTF-8"" standalone=""yes""?>
<Relationships xmlns=""http://schemas.openxmlformats.org/officeDocument/2006/relationships"">
  <Relationship Id=""rId1"" Type=""http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"" Target=""worksheets/sheet1.xml""/>
</Relationships>");
                }

                // 5. xl/worksheets/sheet1.xml
                entry = zip.CreateEntry("xl/worksheets/sheet1.xml");
                using (var sw = new StreamWriter(entry.Open(), Encoding.UTF8))
                {
                    sw.WriteLine(@"<?xml version=""1.0"" encoding=""UTF-8"" standalone=""yes""?>");
                    sw.WriteLine(@"<worksheet xmlns=""http://schemas.openxmlformats.org/spreadsheetml/2006/main"">");
                    sw.WriteLine(@"  <sheetData>");
                    for (int r = 0; r < rows.Count; r++)
                    {
                        var rowData = rows[r];
                        sw.WriteLine(string.Format(@"    <row r=""{0}"">", r + 1));
                        for (int c = 0; c < rowData.Length; c++)
                        {
                            string cellRef = GetCellRef(c, r + 1);
                            string val = rowData[c];
                            
                            decimal numVal;
                            if (r > 0 && decimal.TryParse(val, out numVal))
                            {
                                sw.WriteLine(string.Format(@"      <c r=""{0}""><v>{1}</v></c>", cellRef, numVal));
                            }
                            else
                            {
                                string escaped = val.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;").Replace("'", "&apos;");
                                sw.WriteLine(string.Format(@"      <c r=""{0}"" t=""inlineStr""><is><t>{1}</t></is></c>", cellRef, escaped));
                            }
                        }
                        sw.WriteLine(@"    </row>");
                    }
                    sw.WriteLine(@"  </sheetData>");
                    sw.WriteLine(@"</worksheet>");
                }
            }
        }

        static string GetCellRef(int colIdx, int rowNum)
        {
            string colName = "";
            int temp = colIdx + 1;
            while (temp > 0)
            {
                int mod = (temp - 1) % 26;
                colName = (char)('A' + mod) + colName;
                temp = (temp - 1) / 26;
            }
            return colName + rowNum;
        }
    }
}
