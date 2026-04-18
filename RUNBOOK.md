# Operations Runbook - Semantic Chunk Analyzer

Tài liệu này cung cấp hướng dẫn vận hành, quản trị và xử lý sự cố cho hệ thống Semantic Chunk Analyzer.

## 1. Tổng quan kiến trúc (High-Level Architecture)

*   **Frontend:** React (Vite) + Tailwind CSS + Lucide Icons.
*   **Backend:** Node.js (Express) tích hợp Vite Middleware.
*   **AI Engine:** Tích hợp OpenRouter (cho LLM) và ElevenLabs (cho TTS).
*   **Database & Auth:** Firebase Firestore & Firebase Authentication.
*   **Infrastructure:** Chạy trên nền tảng AI Studio (GCP Cloud Run).

---

## 2. Quản lý cấu hình (Configuration)

### 2.1. Biến môi trường (.env)
Các biến quan trọng cần được cấu hình trong AI Studio Settings:
*   `GEMINI_API_KEY`: Dùng cho các tác vụ AI mặc định.
*   `M2M_API_KEY`: (Optional) Key dự phòng cứng cho các yêu cầu M2M.

### 2.2. Cấu hình ứng dụng (Firebase Firestore)
Toàn bộ settings của ứng dụng được lưu tại Firestore:
*   **Path:** `workspaces/default/settings/ai`
*   **Các tham số chính:**
    *   `primaryModel`: Model AI chính dùng để phân tích.
    *   `elevenLabsApiKey`: Key cho dịch vụ chuyển văn bản thành giọng nói.
    *   `m2mApiKey`: Key thực tế dùng để xác thực các hệ thống bên ngoài gọi vào API.

---

## 3. Các tác vụ vận hành thường gặp (Common Ops Tasks)

### 3.1. Cập nhật Model AI hoặc Prompt
1.  Truy cập vào tab **Settings** của ứng dụng.
2.  Chỉnh sửa `Model ID` hoặc `Ohm Prompt Instructions`.
3.  Nhấn **Save Changes**. Thay đổi có hiệu lực ngay lập tức cho các lượt phân tích tiếp theo.

### 3.2. Cấp mới / Thu hồi M2M API Key
Khi cần thay đổi mã bảo mật cho hệ thống bên thứ ba:
1.  Vào **Settings > API Integration**.
2.  Nhấn **Auto-generate Key** hoặc nhập mã mới thủ công.
3.  Nhấn **Save Changes**. Mã cũ sẽ bị vô hiệu hóa ngay khi backend load lại config từ DB.

---

## 4. Giám sát & Nhật ký (Monitoring & Logs)

### 4.1. Xem Server Logs
Trong môi trường AI Studio, log được in ra console của trình biên dịch:
*   `[API Request] Path: ..., M2M: true/false`: Theo dõi các yêu cầu gọi vào API.
*   `TTS Error`: Lỗi phát sinh từ ElevenLabs.
*   `Ohm Process Error`: Lỗi phát sinh trong quá trình AI phân tích.

### 4.2. Kiểm tra Trạng thái Firebase
Nếu dữ liệu không load được:
*   Kiểm tra tab **Network** trong DevTools trình duyệt.
*   Tìm mã lỗi Firestore (ví dụ: `403 Forbidden` thường do Security Rules).

---

## 5. Xử lý sự cố (Troubleshooting)

### 5.1. Lỗi "302 Redirect" hoặc CORS khi gọi API từ bên ngoài
*   **Nguyên nhân:** Proxy của nền tảng chặn cookie challenge hoặc lỗi Preflight (OPTIONS).
*   **Cách xử lý:** 
    1. Kiểm tra URL gọi tới có phải là Shared App URL (`-pre-`) hay không.
    2. Đảm bảo Header `Accept: application/json` và `X-Requested-With: XMLHttpRequest` có trong request.
    3. Hệ thống đã hỗ trợ tự động trả về 200 OK cho yêu cầu `OPTIONS` (Preflight) để bypass các giới hạn trình duyệt/proxy.
    4. Sử dụng endpoint `/api/ping` để kiểm tra kết nối xem có bị kẹt 302 không trước khi gọi API chính.

### 5.2. Lỗi "API key not valid" từ AI Provider
*   **Nguyên nhân:** API Key của OpenRouter hoặc ElevenLabs hết hạn/sai.
*   **Cách xử lý:** Cập nhật lại key mới trong tab Settings.

### 5.3. Kết quả phân tích không chính xác
*   **Nguyên nhân:** Prompt Instructions quá phức tạp hoặc Model AI không hiểu ngữ cảnh.
*   **Cách xử lý:** 
    1. Đơn giản hóa `Ohm Prompt Instructions` trong tab Settings.
    2. Kiểm tra lại `Ohm Base Values` xem các giá trị nhân có bị đặt về 0 hay không.

---

## 6. Liên hệ & Bảo trì
Hệ thống này được quản lý tự động bởi AI Studio. Khi có cập nhật về Code:
1.  Sửa code trực tiếp trong File Explorer.
2.  Đợi trình biên dịch tự động build lại.
3.  Nếu server treo, sử dụng lệnh `restart_dev_server` (hoặc refresh UI).
