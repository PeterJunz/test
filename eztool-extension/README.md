# EZ Ads Toolkit – Chrome Extension

Bộ công cụ hỗ trợ dân chạy quảng cáo Facebook (lấy cảm hứng từ eztool.vn). Chỉ dùng **Graph API chính thức**, dữ liệu lưu trên máy (`chrome.storage.local`).

## Tính năng
- **Tài khoản QC**: danh sách TKQC, trạng thái, lý do khoá, đã chi tiêu, số dư nợ, giới hạn chi, BM; tải chi tiêu theo kỳ; lọc/tìm; copy ID; xuất CSV.
- **Chiến dịch**: xem chiến dịch + chi tiêu/hiển thị/click/CTR/CPC; bật/tắt từng chiến dịch hoặc hàng loạt; xuất CSV.
- **Business Manager**: danh sách BM, trạng thái xác minh, số TK QC/Page; xem TK QC của từng BM.
- **Fanpage**: danh sách Page bạn quản lý, lượt thích, theo dõi, quyền.
- **Tiện ích**: lấy ID từ link Facebook, xử lý văn bản (lọc trùng, sắp xếp, trích UID/email/SĐT/link, gộp, tách cột, chia nhóm), email tạm + tự bắt OTP (mail.tm), tạo mã 2FA (TOTP).

## Cài đặt
1. Giải nén `eztool-extension.zip` (hoặc dùng thư mục `eztool-extension/`).
2. Mở `chrome://extensions` → bật **Developer mode** → **Load unpacked** → chọn thư mục.
3. Bấm icon tiện ích → mở dashboard → **Cài đặt token** → dán User Access Token từ Graph API Explorer.

Để đăng lên Chrome Web Store: tải file `eztool-extension.zip` lên https://chrome.google.com/webstore/devconsole.
