# TÀI LIỆU LOGIC ĐỐI SOÁT XUẤT HÀNG (KFM vs ABA)

Tài liệu này lưu trữ lại toàn bộ quy tắc đối soát và cấu trúc dữ liệu đã được phân tích. Bạn có thể xem lại tài liệu này để hiểu kịch bản chạy dữ liệu nằm trong thư mục `Script`.

## 1. Nguồn Dữ Liệu & Cấu Trúc Cột
Script sẽ đọc 3 file đầu vào được xuất từ hệ thống:

**A. File Data ST (Dữ liệu ánh xạ)**
- *Vị trí:* `Data\Data ST\DATA ST.xlsx`
- *Cột sử dụng:* 
  - `Nơi nhận` (Dùng để khớp với tên chi nhánh bên KFM)
  - `Nơi nhận (viết tắt)` (Dùng làm tiền tố cho Key đối soát)

**B. File KFM (Dữ liệu xuất)**
- *Vị trí:* `Data\KFM\transfer_*.xlsx` (hoặc tên bất kỳ)
- *Cột sử dụng:*
  - `Chi nhánh nhận`
  - `Mã hàng`
  - `Tên hàng`
  - `Số lượng chuyển`

**C. File ABA (Dữ liệu giao)**
- *Vị trí:* `Data\ABA\Copy of *.xlsx` (hoặc tên bất kỳ)
- *Cột sử dụng:*
  - `Mã CH` (Mã ST)
  - `Mã SP` (Mã sản phẩm)
  - `Tên SP` (Tên sản phẩm)
  - `Số lượng giao`

## 2. Quy Tắc Xử Lý & Đối Soát
1. **Lọc dữ liệu:** Ở phía file KFM, tự động loại bỏ tất cả các dòng có `Mã hàng` bắt đầu bằng ký tự **"C"**.
2. **Khớp tên chi nhánh (Mapping):** Lấy `Chi nhánh nhận` của KFM dò trong bảng Data ST để lấy ra `Nơi nhận (viết tắt)`.
3. **Tạo Khóa Đối Soát (Key):**
   - Phía KFM: `[Nơi nhận viết tắt]_[Mã hàng]`
   - Phía ABA: `[Mã CH]_[Mã SP]`
4. **Tổng hợp & Tính chênh lệch:** 
   - Gom nhóm (Sum) tổng số lượng theo từng Key ở cả 2 bên.
   - Tính chênh lệch: `Diff = Số lượng chuyển (KFM) - Số lượng giao (ABA)`
   - *Lưu ý:* Những dòng khớp số lượng (`Diff = 0`) sẽ được tự động loại bỏ để file kết quả chỉ tập trung vào các trường hợp bị lệch.
5. **Xử lý định dạng:** Các mã sản phẩm được bọc bằng công thức `="mã"` để tránh lỗi Excel biến số thành định dạng khoa học (ví dụ: `8.93E+12`).

## 3. Cách Vận Hành Của Thư Mục Script
- Thư mục `Script` chỉ chứa các file thực thi (`RunReconcile.bat` và `ReconcileData.cs`). 
- Khi chạy file `.bat`, nó sẽ tự động dùng PowerShell convert 3 file Excel trong thư mục `Data` sang định dạng `.csv` ẩn, sau đó biên dịch code C# và thực hiện đối soát tốc độ cao.
- Kết quả được lưu tự động vào `Ouput\Result.csv`.

---
*Ghi chú: Tài liệu này được tạo tự động bởi Antigravity AI để lưu vết cấu trúc dữ liệu, giúp dễ dàng bảo trì hoặc nâng cấp logic code sau này.*
