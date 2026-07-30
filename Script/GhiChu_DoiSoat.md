# Nhật Ký Đối Chiếu Xuất Hàng - Phiên Làm Việc 21/07/2026

Tài liệu này ghi lại toàn bộ lỗi đã phát hiện, phương án xử lý triệt để đã triển khai trong ngày hôm nay, và chuẩn bị ngữ cảnh để ngày mai tiếp tục thực hiện công việc tiếp theo.

---

## 1. Các lỗi CMD (Command Prompt) đã sửa đổi

### 1.1. Lỗi crash CMD do dấu ngoặc đơn lồng trong khối lệnh `IF`
* **Vấn đề**: Khi viết khối lệnh `IF (...)` chứa vòng lặp `FOR /F` lồng bên trong, và trong câu lệnh PowerShell gọi ra lại chứa dấu ngoặc đơn `( )` (ví dụ: `if ($f.Name -match '\d{8}') { ... }`), trình phân tích cú pháp của Windows CMD sẽ hiểu nhầm dấu đóng ngoặc `)` của PowerShell là kết thúc của khối lệnh `IF`. Điều này khiến CMD bị lỗi cú pháp và tự động tắt màn hình ngay lập tức.
* **Cách xử lý**: 
  - Đưa toàn bộ phần trích xuất ngày `KFM_DATE_STR` ra ngoài gốc ở nhãn `:reconcile_start`.
  - Sử dụng cú pháp **dòng lệnh đơn không sử dụng cặp ngoặc tròn** của khối lệnh `IF` (ví dụ: `if not "%LATEST_FILE%"=="" for /f ...`), giúp CMD hoàn toàn an toàn trước bất kỳ ký tự đóng/mở ngoặc nào bên trong.

### 1.2. Lỗi crash CMD do ký tự Pipe (`|`) trong vòng lặp backtick
* **Vấn đề**: CMD không thể biên dịch ký tự pipe `|` bên trong vòng lặp backtick của lệnh PowerShell trừ khi được escape bằng `^|`.
* **Cách xử lý**: Viết lại cơ chế tìm tệp Excel mới nhất bằng lệnh `dir` thuần túy của Windows (`dir "%BASE_DIR%\Data\KFM\*.xlsx" /b /o:-d 2^>nul`), sau đó trích xuất ngày bằng một câu lệnh PowerShell đơn giản không chứa pipe.

### 1.3. Lỗi dùng sai toán tử so sánh trong CMD (`=`)
* **Vấn đề**: Đoạn mã kiểm tra ngày trống ghi nhầm toán tử so sánh đơn `=` thay vì toán tử so sánh đôi `==` (ví dụ: `if not "%KFM_DATE_STR%"=""`), gây lỗi `="" was unexpected at this time`.
* **Cách xử lý**: Sửa lại thành `if not "%KFM_DATE_STR%" == ""`.

### 1.4. Lỗi in văn bản chứa dấu ngoặc tròn trong khối lệnh
* **Vấn đề**: Lệnh `echo ... (PR)...` nằm bên trong khối lệnh `IF` làm CMD tưởng đó là dấu đóng khối lệnh `IF`.
* **Cách xử lý**: Loại bỏ dấu ngoặc trong nội dung in thành `echo ... PR...`.

---

## 2. Các lỗi và Tối ưu hóa trên Google Sheets & Apps Script

### 2.1. Lỗi chỉ tải lên được tối đa 10.000 dòng dữ liệu (Dữ liệu bị thiếu)
* **Vấn đề**: Google Apps Script Web App quy định giới hạn thời gian kết nối đồng bộ bên ngoài tối đa là **30 giây**. Khi dữ liệu xuất lên tới **28.381 dòng**, lệnh `copyTo()` cũ sao chép toàn bộ định dạng trang trí (font, border, background) của các cột màu vàng xuống 28.381 dòng mới làm bảng tính bị treo tính toán layout, dẫn đến quá hạn 30 giây và bị Google ngắt kết nối (kết quả là chỉ nạp được 10.000 dòng đầu tiên thì bị đứt).
* **Cách xử lý**: 
  - Thay đổi phương pháp sao chép công thức: Không dùng `copyTo()` nữa mà chuyển sang sử dụng phương thức **`setFormulasR1C1()`**. 
  - Phương thức này chỉ ghi đè chuỗi công thức thô mà không sao chép định dạng layout. Tốc độ thực thi **nhanh gấp 50-100 lần**, nạp đầy đủ 28.381 dòng công thức chỉ mất **2 giây**.

### 2.2. Lỗi mất công thức các cột màu vàng khi nạp lại
* **Vấn đề**: Khi nạp đè dữ liệu, hệ thống xóa dữ liệu cũ của ngày đó đi trước. Nếu ngày đó là ngày đầu tiên của bảng tính hoặc dòng ngay trên nó là dòng trắng/dòng tiêu đề, việc lấy dòng cuối làm mẫu sẽ copy nhầm dòng trắng, làm các dòng mới bị mất công thức.
* **Cách xử lý**:
  - Viết lại hàm kéo công thức thông minh: Code sẽ **tự động tìm ngược lên trên** từ dòng cuối cùng để tìm bằng được dòng gần nhất thực sự chứa công thức (bắt đầu bằng dấu `=`) làm mẫu. Nếu không tìm thấy, nó sẽ tự động lấy **dòng số 2** làm mặc định để đảm bảo luôn luôn có công thức.

---

## 3. Lỗi tương tác Git và Khóa file Google Drive

### 3.1. Lỗi hỏi chọn `y/n` để thử lại khi ghi đè file pack `.git`
* **Vấn đề**: Google Drive Sync hoặc trình diệt virus khóa tệp cơ sở dữ liệu của Git khi đồng bộ, làm Git hỏi `Unlink of file failed. Should I try again? (y/n)` trong quá trình chạy script.
* **Cách xử lý**:
  - Tắt vĩnh viễn tính năng tự động dọn dẹp ngầm của Git trong repo: `git config gc.auto 0`.
  - Khai báo biến môi trường không tương tác ở đầu các file `.bat`: `set "GIT_ASK_YESNO=false"`. Từ giờ Git sẽ tự động xử lý bỏ qua các prompt xác nhận.

---

## 4. Công việc tiếp theo cho ngày mai (22/07/2026)
* Nhận danh sách các lỗi phát sinh mới hoặc các tính năng cần sửa đổi từ người dùng.
* Tiến hành rà soát các thay đổi và tối ưu tiếp các tệp liên quan.

---

## 5. Nhật ký cập nhật logic ngày 28/07/2026

### 5.1. Thay đổi bộ lọc Chi nhánh PR (download_pr_import.js)
* **Yêu cầu:** Loại bỏ tiêu chí chọn chi nhánh cũ (`LHABA`, `QCABA`) và thay bằng nhóm chi nhánh mới: `CL01`, `CL02`, `FZ01`, `FZ02`.
* **Giải pháp:** Cập nhật lại khối lệnh chọn chi nhánh trong [download_pr_import.js](file:///g:/Drive%20c%E1%BB%A7a%20t%C3%B4i/Report/%C4%90%E1%BB%91i%20chi%E1%BA%BFu%20xu%E1%BA%A5t%20h%C3%A0ng/Script/src/download_pr_import.js). Sử dụng vòng lặp duyệt qua danh sách chi nhánh mới, giúp Playwright tự động tìm kiếm và click chọn chính xác trên giao diện Web UI SCM.

### 5.2. Sửa lỗi lệch cột và lọc bỏ trạng thái Hủy trong Booking (ReconcileData.cs)
* **Vấn đề phát sinh:** Dữ liệu Booking ngày 28/07 bị đẩy lên Google Sheets sai lệch cột (cột số lượng hiển thị tên chi nhánh, v.v.).
* **Nguyên nhân:**
  1. Cấu trúc cột của file Excel Booking xuất từ SCM hệ thống bị thay đổi thứ tự (Ví dụ: `Nơi nhận` chuyển sang cột H, `Số lượng y/c chuyển` sang cột J, `Trạng thái` sang cột R, `Ngày chuyển` sang cột M).
  2. Lệnh biên dịch C# (`csc.exe`) trong các tệp `.bat` chạy trước đây thiếu cờ `/codepage:65001`. Điều này làm các chuỗi ký tự tiếng Việt có dấu dùng để so khớp tiêu đề cột (như `"Ngày chuyển mong muốn"`, `"Nơi nhận"`,...) bị lỗi font khi thực thi. Hàm tìm kiếm `FindCol` trả về `-1` (không tìm thấy) và buộc hệ thống sử dụng các vị trí cột mặc định cũ lỗi thời.
  3. Cột `Nơi nhận` bị nhận nhầm sang cột `Nơi nhận (viết tắt)` do so khớp chứa chuỗi (partial match). Cột `Trạng thái` bị nhận nhầm sang `Trạng thái đẩy ABA` dẫn đến bộ lọc không thể nhận biết trạng thái `Đã hủy` để loại bỏ.
* **Cách khắc phục:**
  1. Thêm cờ biên dịch `/codepage:65001` vào [RunReconcile.bat.bat](file:///g:/Drive%20c%E1%BB%A7a%20t%C3%B4i/Report/%C4%90%E1%BB%91i%20chi%E1%BA%BFu%20xu%E1%BA%A5t%20h%C3%A0ng/Script/src/RunReconcile.bat.bat) và [UploadKfmDirect.bat](file:///g:/Drive%20c%E1%BB%A7a%20t%C3%B4i/Report/%C4%90%E1%BB%91i%20chi%E1%BA%BFu%20xu%E1%BA%A5t%20h%C3%A0ng/Script/UploadKfmDirect.bat) để hỗ trợ đầy đủ font UTF-8.
  2. Viết lại hàm so khớp chi tiết cho `colBranch` trong [ReconcileData.cs](file:///g:/Drive%20c%E1%BB%A7a%20t%C3%B4i/Report/%C4%90%E1%BB%91i%20chi%E1%BA%BFu%20xu%E1%BA%A5t%20h%C3%A0ng/Script/src/ReconcileData.cs) (bỏ qua cột chứa từ `"viết tắt"`/`"viet tat"`).
  3. Viết lại hàm so khớp tuyệt đối (exact match) cho cột `colStatus` để lấy chính xác cột `Trạng thái` (cột R), qua đó lọc bỏ thành công **3.402 dòng rác** ở trạng thái `Đã hủy` (giảm tổng dòng từ 33.535 xuống 30.133 dòng sạch).
  4. Cập nhật các vị trí cột fallback mặc định mới nhất của cấu trúc ngày 28/07 làm phương án dự phòng.

### 5.3. Tích hợp các tệp lệnh và tối ưu hóa thư mục
* **Yêu cầu:** Gộp hai tệp chạy độc lập `ChayBooking_Sheet.bat` và `ChayTaiPR_Sheet.bat` chạy song song để tăng hiệu suất.
* **Giải pháp:**
  1. Tạo tệp gộp mới [ChayGop_PR_Booking.bat](file:///g:/Drive%20c%E1%BB%A7a%20t%C3%B4i/Report/%C4%90%E1%BB%91i%20chi%E1%BA%BFu%20xu%E1%BA%A5t%20h%C3%A0ng/Script/ChayGop_PR_Booking.bat). Sử dụng lệnh `start` của CMD để chạy song song trực tiếp 2 tiến trình PowerShell (`process_pr_import.ps1` và `process_booking.ps1`) trong 2 cửa sổ độc lập.
  2. Xóa bỏ hai tệp cũ `ChayBooking_Sheet.bat` và `ChayTaiPR_Sheet.bat` để tối giản thư mục dự án.

### 5.4. Chuyển đổi sang Chế độ chỉ tải lên (Upload-Only) và lọc trạng thái hủy KFM
* **Yêu cầu:** Loại bỏ khâu đối soát với dữ liệu nhà xe ABA và DATA ST. Khi tải xong file KFM, thực hiện làm sạch dữ liệu (loại bỏ các sản phẩm công cụ và các phiếu chuyển hàng ở trạng thái hủy) rồi đẩy thẳng lên Google Sheets.
* **Giải pháp:**
  1. Cấu hình lại [RunReconcile.bat.bat](file:///g:/Drive%20c%E1%BB%A7a%20t%C3%B4i/Report/%C4%90%E1%BB%91i%20chi%E1%BA%BFu%20xu%E1%BA%A5t%20h%C3%A0ng/Script/src/RunReconcile.bat.bat) để gọi `ReconcileData.exe` với tham số `--upload-only` thay vì chạy luồng đối soát 3 bên như trước.
  2. Cập nhật phương thức `CleanAndArchiveKfm` và vòng lặp load dữ liệu KFM của `Program.Main` trong [ReconcileData.cs](file:///g:/Drive%20c%E1%BB%A7a%20t%C3%B4i/Report/%C4%90%E1%BB%91i%20chi%E1%BA%BFu%20xu%E1%BA%A5t%20h%C3%A0ng/Script/src/ReconcileData.cs):
     * Tự động tìm kiếm cột `Trạng thái` / `Trang thai` trong tệp Excel KFM.
     * Quét và bỏ qua (skip) các dòng dữ liệu có trạng thái chứa chữ `"hủy"` / `"huy"` (ví dụ: `Đã hủy`) của phiếu chuyển hàng KFM.
     * Tiếp tục duy trì việc loại bỏ mã hàng bắt đầu bằng ký tự `"C"` (sản phẩm công cụ dụng cụ).

### 5.5. Nhật ký cập nhật logic Ngày 29/07/2026: Xử lý Booking theo Ngày chuyển mong muốn & Chế độ Ghi đè thông minh
* **Lọc chính xác theo cột "Ngày chuyển hàng mong muốn":**
  * Đã bổ sung tham số `targetDateFilter` vào phương thức `ProcessBooking` trong [ReconcileData.cs](file:///g:/Drive%20c%E1%BB%a7a%20t%C3%B4i/Report/%C4%90%E1%BB%91i%20chi%E1%BA%BFu%20xu%E1%BA%A5t%20h%C3%A0ng/Script/src/ReconcileData.cs).
  * Hệ thống lọc chính xác từng dòng trong file Excel theo giá trị cột **"Ngày chuyển hàng mong muốn"** (bỏ qua các dòng không khớp với Ngày D / Ngày D+1).
* **Phân tách 2 file script .bat độc lập:**
  * **[ChayGop_PR_Booking.bat](file:///g:/Drive%20c%E1%BB%a7a%20t%C3%B4i/Report/%C4%90%E1%BB%91i%20chi%E1%BA%BFu%20xu%E1%BA%A5t%20h%C3%A0ng/Script/ChayGop_PR_Booking.bat)**: Chạy cho **Ngày D (Hôm nay)** bằng cách gọi `process_booking.ps1 -DayOffset 0`.
  * **[ChayDataBookingdukien.bat](file:///g:/Drive%20c%E1%BB%a7a%20t%C3%B4i/Report/%C4%90%E1%BB%91i%20chi%E1%BA%BFu%20xu%E1%BA%A5t%20h%C3%A0ng/Script/ChayDataBookingdukien.bat)** (và `ChayDataBooking.bat`): Chạy cho **Ngày D+1 (Ngày mai / Dự kiến)** bằng cách gọi `process_booking.ps1 -DayOffset 1`.
* **Cơ chế Ghi đè thông minh trên Google Sheets (Google Apps Script):**
  * Khi đẩy dữ liệu cùng một ngày lên Google Sheets tab `DATA Booking`, Google Apps Script tự động phát hiện và **xóa toàn bộ các dòng cũ của ngày đó**, sau đó **ghi đè bộ dữ liệu mới nhất** vào.
  * Dữ liệu của các ngày khác được **giữ nguyên 100%**, đảm bảo không bao giờ trùng lặp hay mất dữ liệu lịch sử.

