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
                int kfmColProduct = FindCol(kfmData[0], new[] { "Mã hàng", "Ma hang" });
                int kfmColQty = FindCol(kfmData[0], new[] { "Số lượng chuyển", "So luong chuyen" });
                
                // Fallbacks based on structure
                if (kfmColBranch == -1) kfmColBranch = 3;
                if (kfmColProduct == -1) kfmColProduct = 7;
                int kfmColProductName = FindCol(kfmData[0], new[] { "Tên hàng", "Ten hang" });
                if (kfmColQty == -1) kfmColQty = 10;
                if (kfmColProductName == -1) kfmColProductName = 8;

                // kfmDict: Key -> Total Qty
                var kfmDict = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
                var productNameDict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                var productCategoryDict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                var productLoaiHangDict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                
                for (int i = 1; i < kfmData.Count; i++)
                {
                    var row = kfmData[i];
                    if (row.Length > Math.Max(kfmColBranch, Math.Max(kfmColProduct, kfmColQty)))
                    {
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
                        decimal.TryParse(qtyStr, out qty);

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
                        string category = (row.Length > abaColCategory) ? row[abaColCategory].Trim() : "";
                        string loaiHang = (abaColLoaiHang != -1 && row.Length > abaColLoaiHang) ? row[abaColLoaiHang].Trim() : "";

                        string key = stCode + "_" + product;

                        decimal qty = 0;
                        decimal.TryParse(qtyStr, out qty);

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
                
                // Header
                results.Add(new[] { "Key (ST_Code)", "ST Code / Abbr", "Product Code", "Product Name", "Category", "Loai Hang", "KFM Qty (SL Chuyen)", "ABA Qty (SL Giao)", "Diff (Lech)" });

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

                    if (!string.IsNullOrEmpty(st)) {
                        stLechList.Add(st);
                        string catInfo = string.IsNullOrEmpty(prodCategory) ? prodLoaiHang : prodCategory;
                        if (string.IsNullOrEmpty(catInfo)) catInfo = "Khong xac dinh";
                        
                        string wKey = st + "|" + catInfo;
                        if (warningDict.ContainsKey(wKey)) warningDict[wKey] += diff;
                        else warningDict[wKey] = diff;
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
                        diff.ToString() 
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

                html.AppendLine(@"<div class=""section-title"">🚨 Chi Tiết Cảnh Báo Thiếu Phiếu</div>");
                
                var formattedWarnings = new List<string>();
                if (warningDict.Count == 0) {
                    html.AppendLine(@"<div class=""success-banner"">✨ TUYỆT VỜI! 100% Khớp Số Liệu. Không Phát Hiện Thiếu Phiếu!</div>");
                } else {
                    html.AppendLine(@"<ul class=""warning-list"">");
                    foreach(var kvp in warningDict.OrderBy(x => x.Key)) {
                        var wparts = kvp.Key.Split('|');
                        string sw = wparts[0];
                        string cw = wparts[1];
                        string wMsg = string.Format("=> CANH BAO: Chi nhanh [{0}] dang lech hang '{1}' (Kha nang chua tao phieu! Tong so luong lech: {2})", sw, cw, kvp.Value);
                        formattedWarnings.Add(wMsg);
                        
                        html.AppendLine(string.Format(@"<li class=""warning-item"">
                            <span>Chi nhánh <b>{0}</b> thiếu phiếu nhóm hàng <b>{1}</b></span>
                            <span class=""qty-badge"">Lệch {2}</span>
                        </li>", sw, cw, kvp.Value));
                    }
                    html.AppendLine(@"</ul>");
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

                    if (warningDict.Count == 0) {
                        tgMsg.AppendLine("\n✅ <i>Tuyệt vời! 100% khớp số liệu.</i>");
                    } else {
                        var meatWarnings = new List<string>();
                        var frozenWarnings = new List<string>();
                        var otherWarnings = new List<string>();
                        
                        var meatStSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                        var frozenStSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                        foreach (var kvp in warningDict.OrderBy(x => x.Key))
                        {
                            var wparts = kvp.Key.Split('|');
                            string sw = wparts[0];
                            string cw = wparts[1];
                            decimal val = kvp.Value;
                            
                            string itemStr = string.Format("\n• <b>{0}</b>: <b>{1:N0}</b>", sw, val);
                            
                            if (cw.ToLower().Contains("meat"))
                            {
                                meatWarnings.Add(itemStr);
                                meatStSet.Add(sw);
                            }
                            else if (cw.ToLower().Contains("frozen"))
                            {
                                frozenWarnings.Add(itemStr);
                                frozenStSet.Add(sw);
                            }
                            else
                            {
                                otherWarnings.Add(string.Format("\n• <b>{0}</b> (<i>{1}</i>): <b>{2:N0}</b>", sw, cw, val));
                            }
                        }

                        tgMsg.AppendLine(string.Format("🥩 Lệch hàng MEAT: <b>{0} CH</b>", meatStSet.Count));
                        tgMsg.AppendLine(string.Format("❄️ Lệch hàng FROZEN: <b>{0} CH</b>", frozenStSet.Count));
                        tgMsg.AppendLine("-------------------------------------------------");

                        if (meatWarnings.Count > 0)
                        {
                            tgMsg.AppendLine("\n🥩 <b>SIÊU THỊ LỆCH MEAT:</b>");
                            int limit = 15;
                            for (int i = 0; i < Math.Min(meatWarnings.Count, limit); i++)
                            {
                                tgMsg.Append(meatWarnings[i]);
                            }
                            if (meatWarnings.Count > limit)
                            {
                                tgMsg.AppendLine(string.Format("\n... và {0} CH khác.", meatWarnings.Count - limit));
                            }
                        }

                        if (frozenWarnings.Count > 0)
                        {
                            tgMsg.AppendLine("\n\n❄️ <b>SIÊU THỊ LỆCH FROZEN:</b>");
                            int limit = 15;
                            for (int i = 0; i < Math.Min(frozenWarnings.Count, limit); i++)
                            {
                                tgMsg.Append(frozenWarnings[i]);
                            }
                            if (frozenWarnings.Count > limit)
                            {
                                tgMsg.AppendLine(string.Format("\n... và {0} CH khác.", frozenWarnings.Count - limit));
                            }
                        }

                        if (otherWarnings.Count > 0)
                        {
                            tgMsg.AppendLine("\n\n❓ <b>LỆCH NHÓM KHÁC:</b>");
                            int limit = 10;
                            for (int i = 0; i < Math.Min(otherWarnings.Count, limit); i++)
                            {
                                tgMsg.Append(otherWarnings[i]);
                            }
                            if (otherWarnings.Count > limit)
                            {
                                tgMsg.AppendLine(string.Format("\n... và {0} CH khác.", otherWarnings.Count - limit));
                            }
                        }
                    }
                    
                    if (stLechList.Count > 0) {
                        tgMsg.AppendLine("\n📋 <b>DS nhanh ST lệch:</b> " + string.Join(", ", stLechList.OrderBy(x => x)));
                    }

                    try {
                        SendTelegramMessage(telegramToken, telegramChatId, tgMsg.ToString());
                        Console.ForegroundColor = ConsoleColor.Green;
                        Console.WriteLine("Da gui bao cao Telegram thanh cong!");
                        Console.ResetColor();
                    } catch (Exception texc) {
                        Console.ForegroundColor = ConsoleColor.Red;
                        Console.WriteLine("Loi gui Telegram: " + texc.Message);
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

                    // Archive KFM
                    string dateStamp = DateTime.Now.ToString("yyyy-MM-dd");
                    string archiveDir = Path.Combine(rootDir, "Archive", dateStamp);
                    if (!Directory.Exists(archiveDir)) Directory.CreateDirectory(archiveDir);
                    
                    if (Path.GetFullPath(kfmFile) != Path.GetFullPath(kfmTarget) && File.Exists(kfmFile))
                    {
                        string archiveFile = Path.Combine(archiveDir, Path.GetFileName(kfmFile));
                        if (File.Exists(archiveFile)) File.Delete(archiveFile);
                        File.Move(kfmFile, archiveFile);
                        Console.WriteLine("Da luu tru file KFM: " + Path.GetFileName(kfmFile));
                    }

                    // Write status.json
                    try
                    {
                        string statusFile = Path.Combine(Path.GetDirectoryName(outFile), "status.json");
                        string dailyStatusFile = Path.Combine(Path.GetDirectoryName(outFile), "status_" + kfmDateStr + ".json");
                        string json = string.Format(
                            "{{\n  \"lastUpdated\": \"{0}\",\n  \"kfmFile\": \"{1}\",\n  \"kfmDate\": \"{2}\",\n  \"abaFile\": \"{3}\",\n  \"abaDate\": \"{4}\",\n  \"mismatchCount\": {5},\n  \"participatingStores\": {6},\n  \"resultFile\": \"Result_{7}.csv\"\n}}",
                            DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                            Path.GetFileName(kfmFile).Replace("\\", "\\\\").Replace("\"", "\\\""),
                            FormatDate(kfmDateStr),
                            Path.GetFileName(abaFile).Replace("\\", "\\\\").Replace("\"", "\\\""),
                            FormatDate(abaDateStr),
                            stLechList.Count,
                            allStSet.Count,
                            kfmDateStr
                        );
                        File.WriteAllText(statusFile, json, Encoding.UTF8);
                        File.WriteAllText(dailyStatusFile, json, Encoding.UTF8);
                        Console.WriteLine("Da ghi file status va status theo ngay thanh cong!");

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
    }
}
