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
