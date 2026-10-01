# Telegram bot báo cáo chi tiêu quảng cáo Facebook

Bot tự động gửi báo cáo chi tiêu quảng cáo Facebook mỗi ngày vào Telegram, và cho phép xem báo cáo theo lệnh.

## Tính năng

- ⏰ Mỗi ngày gửi báo cáo của **ngày hôm qua** vào giờ cố định (mặc định 08:00, giờ Việt Nam)
- 💰 Chi tiêu, hiển thị, tiếp cận, click, CTR, CPC, CPM
- 🎯 Kết quả chính: tin nhắn, khách hàng tiềm năng, mua hàng, kèm chi phí trên mỗi kết quả
- 📈 So sánh % chi tiêu với kỳ liền trước (ví dụ hôm qua so với hôm kia)
- 🏆 Top chiến dịch chi tiêu nhiều nhất
- 🗂 Hỗ trợ nhiều tài khoản quảng cáo, nhiều chat/group nhận báo cáo
- 🔒 Chỉ các chat ID trong danh sách mới dùng được lệnh

### Lệnh

| Lệnh | Mô tả |
|---|---|
| `/homnay` | Chi tiêu hôm nay (tạm tính đến hiện tại) |
| `/homqua` | Báo cáo hôm qua |
| `/ngay 25/09/2026` | Báo cáo một ngày cụ thể |
| `/tuan` | 7 ngày gần nhất |
| `/thang` | Từ đầu tháng đến hôm nay |
| `/chatid` | Xem chat ID (dùng khi cài đặt) |

### Ví dụ báo cáo

```
Báo cáo chi tiêu quảng cáo hàng ngày
🗓 30/09/2026

📊 Shop ABC act_1234567890
💰 Chi tiêu: 2.350.000 ₫ (🔺 12,5%)
👁 Hiển thị: 185.420 · Tiếp cận: 120.300
🖱 Click: 3.210 · CTR: 1,73%
💵 CPC: 732 ₫ · CPM: 12.674 ₫
🎯 Tin nhắn: 94 · Chi phí/kết quả: 25.000 ₫

🏆 Top 3 chiến dịch
1. Mess - Áo thun — 1.200.000 ₫ · 52 tin nhắn
2. Mess - Quần jean — 800.000 ₫ · 42 tin nhắn
3. Remarketing — 350.000 ₫
```

## Cài đặt

### 1. Tạo bot Telegram

1. Chat với [@BotFather](https://t.me/BotFather), gõ `/newbot` và làm theo hướng dẫn.
2. Lưu lại **token** (dạng `123456789:ABC...`).
3. Nếu muốn gửi vào group: thêm bot vào group.

### 2. Lấy Facebook access token

Cách khuyến nghị (token không hết hạn) — dùng **System User**:

1. Vào [Business Settings](https://business.facebook.com/settings) → **Người dùng → Người dùng hệ thống** → Thêm.
2. Gán tài khoản quảng cáo cho system user (quyền xem là đủ).
3. Bấm **Tạo mã mới**, chọn app của bạn và tick quyền **`ads_read`**.

> Để thử nhanh có thể lấy token tạm từ [Graph API Explorer](https://developers.facebook.com/tools/explorer/) với quyền `ads_read` (token này hết hạn sau khoảng 1–2 giờ).

ID tài khoản quảng cáo xem trong Ads Manager (dãy số trên URL `act=...`).

### 3. Cấu hình

```bash
cp .env.example .env
# sửa .env: TELEGRAM_BOT_TOKEN, FB_ACCESS_TOKEN, FB_AD_ACCOUNT_IDS, TELEGRAM_CHAT_IDS
```

Chưa biết chat ID? Tạm điền một số bất kỳ vào `TELEGRAM_CHAT_IDS`, chạy bot, gửi `/chatid` cho bot (hoặc trong group), rồi điền ID nhận được và khởi động lại.

| Biến | Ý nghĩa | Mặc định |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Token từ BotFather | bắt buộc |
| `TELEGRAM_CHAT_IDS` | Chat ID nhận báo cáo/được dùng lệnh, cách nhau dấu phẩy | bắt buộc |
| `FB_ACCESS_TOKEN` | Facebook access token có quyền `ads_read` | bắt buộc |
| `FB_AD_ACCOUNT_IDS` | ID tài khoản quảng cáo, cách nhau dấu phẩy | bắt buộc |
| `FB_API_VERSION` | Phiên bản Graph API | `v21.0` |
| `REPORT_TIME` | Giờ gửi báo cáo (HH:MM) | `08:00` |
| `TIMEZONE` | Múi giờ | `Asia/Ho_Chi_Minh` |
| `TOP_CAMPAIGNS` | Số chiến dịch top hiển thị | `5` |

### 4. Chạy

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m fb_ads_bot
```

Hoặc bằng Docker:

```bash
docker build -t fb-ads-bot .
docker run -d --restart unless-stopped --env-file .env --name fb-ads-bot fb-ads-bot
```

Bot cần chạy liên tục (VPS, máy chủ, Railway, Render…) để gửi báo cáo đúng giờ.

## Kiểm thử

```bash
pip install pytest
pytest
```

## Lưu ý

- Ngày báo cáo được tính theo `TIMEZONE`; Facebook tính số liệu theo múi giờ của tài khoản quảng cáo, nên hãy đặt `TIMEZONE` trùng với múi giờ tài khoản.
- Số liệu của Facebook có thể còn cập nhật thêm vài giờ sau khi hết ngày, vì vậy báo cáo hằng ngày nên gửi vào buổi sáng.
- Nếu nhiều tài khoản dùng các loại tiền khác nhau, tổng chi tiêu được hiển thị riêng theo từng loại tiền.
