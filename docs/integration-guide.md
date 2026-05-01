# CHUNKS API Integration Guide (S2S)

Welcome to the **CHUNKS Core API Integration Guide**. This document is designed for Developers and Senior Engineers looking to integrate CHUNKS linguistic capabilities into their own applications.

---

## 1. Introduction
The CHUNKS API provides high-performance tools for linguistic analysis (Ohm Calculation), Text-to-Speech (TTS), and Speech-to-Text (STT). It is optimized for **Server-to-Server (S2S)** communication with a focus on traceability and reliability.

## 2. Environments & Base URLs
| Environment | Base URL |
| :--- | :--- |
| **Production** | `https://api.chunks-app.ai/v1` |
| **Staging** | `https://staging-api.chunks-app.ai/v1` |

---

## 3. Authentication
All requests must be authenticated using one of the following methods in the HTTP Header:

### A. Bearer Token (Recommended)
`Authorization: Bearer <YOUR_JWT_TOKEN>`

### B. API Key (Simple M2M)
`X-API-Key: <YOUR_SECURE_API_KEY>`

*To obtain credentials, please contact your account manager or use the Settings Dashboard in the CHUNKS App.*

---

## 4. Standard Headers
To maintain professional service levels, the following headers are required or highly recommended:

| Header | Required | Description |
| :--- | :--- | :--- |
| `Content-Type` | Yes | Must be `application/json` |
| `X-Correlation-ID` | **Yes** | A unique execution ID (UUID). This ID will be used in logs to track the request lifetime. |
| `X-Idempotency-Key` | Only POST/PUT | A unique key to prevent duplicate processing on retries. |

---

## 5. Rate Limiting (Quotas)
- **Standard Tier:** 100 requests per minute (RPM).
- **Enterprise Tier:** Personalized quotas based on SLA.
- If you exceed the limits, the API returns a `429 Too Many Requests` status.

---

## 6. Status Codes & Error Handling
We use standard HTTP status codes. All errors return a uniform JSON body:

```json
{
  "code": "ERROR_CODE",
  "message": "Human readable explanation",
  "trace_id": "YOUR_CORRELATION_ID"
}
```

| Code | Meaning |
| :--- | :--- |
| `200` | Success. |
| `400` | Bad Request (Missing parameters). |
| `401` | Unauthorized (Invalid token/key). |
| `403` | Forbidden (Insufficient permissions). |
| `429` | Rate limit exceeded. |
| `500` | Internal Server Error. |

---

## 7. Sample Code

### curl (Linguistic Analysis)
```bash
curl -X POST https://api.chunks-app.ai/v1/analysis/linguistic \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Correlation-ID: unique-trace-123" \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "Actually, I wanted to tell you that honey catches more flies than vinegar."
  }'
```

### Node.js (Axios)
```javascript
const axios = require('axios');
const uuid = require('uuid');

async function analyzeChunks(text) {
  try {
    const response = await axios.post('https://api.chunks-app.ai/v1/analysis/linguistic', {
      transcript: text
    }, {
      headers: {
        'Authorization': 'Bearer YOUR_TOKEN',
        'X-Correlation-ID': uuid.v4(),
        'X-API-Key': 'YOUR_KEY'
      }
    });
    console.log('Analysis Result:', response.data);
  } catch (error) {
    console.error('API Error:', error.response.data);
  }
}
```

---
*For further assistance, reach out to developers@chunks-app.ai*
