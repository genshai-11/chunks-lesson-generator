# Semantic Chunk Analysis API Documentation (Ohm Calculation)

Tài liệu này hướng dẫn cách tích hợp và sử dụng API phân tích ngôn ngữ (Ohm Analysis) dành cho hệ thống bên thứ ba (Machine-to-Machine).

## 1. Thông tin chung (Endpoint)

Để bỏ qua các lớp kiểm tra cookie (Cookie Challenge) của nền tảng, bạn **PHẢI** sử dụng URL của phiên bản Shared App.

*   **Production URL:** `https://ais-pre-msgfyvxutdkvwq3bz4qbhr-148630698694.asia-southeast1.run.app/api/analyze-ohm`
*   **Health Check (Ping):** `https://ais-pre-msgfyvxutdkvwq3bz4qbhr-148630698694.asia-southeast1.run.app/api/ping`
*   **Method:** `POST` (cho analyze) | `GET` (cho ping)

---

## 2. Bảo mật & Xác thực (Authentication)

Hệ thống sử dụng cơ chế **X-API-Key** để xác thực các yêu cầu Server-to-Server.

### Required Headers:
| Header | Giá trị | Ghi chú |
| :--- | :--- | :--- |
| `Accept` | `application/json` | **Bắt buộc** để tránh 302 Redirect |
| `Content-Type` | `application/json` | |
| `X-API-Key` | `m2m_CHUNK_ANALYZER_SECURE_2026` | Mã khóa bảo mật M2M |
| `X-Requested-With` | `XMLHttpRequest` | Hỗ trợ bypass proxy challenge |

---

## 3. Cấu trúc yêu cầu (Request Body)

Dữ liệu gửi lên dưới dạng JSON object.

| Trường | Kiểu | Bắt buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `transcript` | `string` | **Có** | Văn bản cần bóc tách và phân tích Ohm. |
| `webhookUrl` | `string` | Không | URL để nhận kết quả nếu muốn xử lý bất đồng bộ (Async). |
| `settings` | `object` | Không | Cấu hình ghi đè giá trị Ohm hoặc Prompt instructions. |

### Ví dụ Request:
```json
{
  "transcript": "Hôm nay tôi thấy rất vui khi được làm việc cùng bạn.",
  "settings": {
    "ohmBaseValues": {
      "Green": 5,
      "Blue": 7,
      "Red": 9,
      "Pink": 3
    }
  }
}
```

---

## 4. Cấu trúc phản hồi (Response)

### Thành công (Success - 200 OK)
```json
{
  "status": "success",
  "data": {
    "transcriptRaw": "Hôm nay tôi thấy rất vui khi được làm việc cùng bạn.",
    "chunks": [
      {
        "text": "làm việc cùng bạn",
        "label": "BLUE",
        "ohm": 7,
        "confidence": 0.95,
        "reason": "Communication frame"
      }
    ],
    "formula": "7 x ...",
    "totalOhm": 7
  }
}
```

### Lỗi xác thực (401 Unauthorized)
Xảy ra khi thiếu hoặc sai `X-API-Key`.
```json
{
  "status": "error",
  "error": "Unauthorized. Valid X-API-Key is required for M2M."
}
```

### Lỗi tham số (400 Bad Request)
Xảy ra khi thiếu trường `transcript`.
```json
{
  "status": "error",
  "error": "Transcript is required"
}
```

---

## 5. Tích hợp bằng cURL (Mẫu)

Dùng lệnh sau để test nhanh từ terminal:

```bash
curl -X POST "https://ais-pre-msgfyvxutdkvwq3bz4qbhr-148630698694.asia-southeast1.run.app/api/analyze-ohm" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: m2m_CHUNK_ANALYZER_SECURE_2026" \
  -H "X-Requested-With: XMLHttpRequest" \
  -d '{
    "transcript": "Chào mừng bạn đến với hệ thống phân tích Ohm."
  }'
```

---

## 6. Lưu ý quan trọng
1.  **Shared URL:** Tuyệt đối không gọi tới URL có chứa `-dev-` vì sẽ bị kẹt tại màn hình kiểm tra Cookie.
2.  **Timeout:** Quá trình phân tích AI có thể mất từ 3-10 giây. Hãy đảm bảo client của bạn có cấu hình timeout phù hợp.
3.  **Webhook:** Nếu sử dụng `webhookUrl`, hệ thống sẽ trả về phản hồi `processing` ngay lập tức, sau đó gửi kết quả cuối cùng qua POST request tới URL bạn cung cấp.
