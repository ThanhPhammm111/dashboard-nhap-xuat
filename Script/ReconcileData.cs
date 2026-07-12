using System;
using System.IO;
using System.Collections.Generic;
using System.Text;
using System.Linq;
using System.Net;

namespace ReconcileData
{
    class Program
    {
        static void Main(string[] args)
        {
            if (args.Length < 4)
            {
                Console.WriteLine("Usage: ReconcileData.exe <DataST.csv> <KFM.csv> <ABA.csv> <Result.csv>");
                return;
            }

            string dataStFile = args[0];
            string kfmFile = args[1];
            string abaFile = args[2];
            string outFile = args[3];
            string telegramToken = args.Length > 4 ? args[4] : "";
            string telegramChatId = args.Length > 5 ? args[5] : "";

            try
            {
                // 1. Load Data ST mapping
                Console.WriteLine("Doc file DATA ST...");
                var stData = ReadCsv(dataStFile);
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
                var kfmData = ReadCsv(kfmFile);
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
                var abaData = ReadCsv(abaFile);
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
                    Console.ForegroundColor = ConsoleColor.Yellow;
                    Console.WriteLine("Dang gui bao cao qua Telegram Bot...");
                    Console.ResetColor();

                    var tgMsg = new StringBuilder();
                    tgMsg.AppendLine("📊 *BÁO CÁO ĐỐI SOÁT XUẤT HÀNG*");
                    tgMsg.AppendLine(string.Format("\n🏢 Tổng siêu thị tham gia: *{0}*", allStSet.Count));
                    tgMsg.AppendLine(string.Format("🚨 Siêu thị thiếu phiếu: *{0}*", stLechList.Count));
                    
                    if (warningDict.Count == 0) {
                        tgMsg.AppendLine("\n✅ _Tuyệt vời! 100% khớp số liệu._");
                    } else {
                        tgMsg.AppendLine("\n⚠️ *CHI TIẾT CẢNH BÁO:*");
                        foreach(var kvp in warningDict.OrderBy(x => x.Key)) {
                            var wparts = kvp.Key.Split('|');
                            tgMsg.AppendLine(string.Format("❌ Chi nhánh *{0}* lệch hàng _{1}_ (Lệch: *{2}*)", wparts[0], wparts[1], kvp.Value));
                        }
                    }
                    
                    if (stLechList.Count > 0) {
                        tgMsg.AppendLine("\n📋 *DS nhanh ST lệch:* " + string.Join(", ", stLechList.OrderBy(x => x)));
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

        static void SendTelegramMessage(string botToken, string chatId, string message)
        {
            string url = string.Format("https://api.telegram.org/bot{0}/sendMessage", botToken);
            string postData = string.Format("chat_id={0}&text={1}&parse_mode=Markdown", 
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
