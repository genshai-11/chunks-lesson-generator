# Semantic Chunk Analysis API (M2M)

This document describes the machine-to-machine API used to analyze transcripts into semantic chunks and total Ohm.

Use this API when an external system needs structured CHUNKS semantic analysis without using the full web UI.

---

## 1. What the API does

The analysis endpoint:

- accepts a transcript
- classifies substrings into semantic chunk categories
- assigns configured Ohm values
- computes a total Ohm result
- optionally posts async results to a webhook

This API is designed for **server-to-server** or controlled integration use.

---

## 2. Endpoint

### Analyze transcript

```http
POST /api/analyze-ohm
```

### Health check

```http
GET /api/ping
```

### Example shared API origin

Current deployment docs reference a shared API origin such as:

```text
https://ais-pre-msgfyvxutdkvwq3bz4qbhr-148630698694.asia-southeast1.run.app
```

So the full example endpoints become:

- `POST https://ais-pre-msgfyvxutdkvwq3bz4qbhr-148630698694.asia-southeast1.run.app/api/analyze-ohm`
- `GET https://ais-pre-msgfyvxutdkvwq3bz4qbhr-148630698694.asia-southeast1.run.app/api/ping`

> Replace the host with the active shared API origin for your environment.

---

## 3. Authentication

The M2M route requires an API key.

### Required headers

| Header | Value | Notes |
|---|---|---|
| `Accept` | `application/json` | Recommended to keep the response JSON-oriented |
| `Content-Type` | `application/json` | Required for JSON body |
| `X-API-Key` | `YOUR_M2M_API_KEY` | Required |
| `X-Requested-With` | `XMLHttpRequest` | Recommended for gateway/proxy compatibility |

### Important security rule

Never hardcode a real production API key in:

- repository docs
- screenshots
- source code examples
- public support messages

Store the active key in a secure runtime secret store or controlled settings flow.

---

## 4. Request body

### JSON schema

| Field | Type | Required | Description |
|---|---|---|---|
| `transcript` | `string` | Yes | Text to analyze |
| `webhookUrl` | `string` | No | If provided, the API returns immediately and posts the final result to this URL |
| `settings` | `object` | No | Optional override settings for analysis |

### Optional settings fields

The app currently supports settings such as:

- `ohmBaseValues`
- `ohmPromptInstructions`
- custom provider/model config for analysis routes that support it

### Example request

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

## 5. Response format

### Success response

```json
{
  "status": "success",
  "data": {
    "transcriptRaw": "Hôm nay tôi thấy rất vui khi được làm việc cùng bạn.",
    "transcriptNormalized": "Hôm nay tôi thấy rất vui khi được làm việc cùng bạn.",
    "chunks": [
      {
        "text": "làm việc cùng bạn",
        "label": "BLUE",
        "ohm": 7,
        "confidence": 0.95,
        "reason": "Communication frame"
      }
    ],
    "formula": "7",
    "totalOhm": 7
  }
}
```

### Async / webhook-accepted response

If `webhookUrl` is provided, the endpoint may respond immediately with:

```json
{
  "status": "processing",
  "message": "Analysis started and will be sent to webhook."
}
```

### 400 Bad Request

Example:

```json
{
  "status": "error",
  "error": "Transcript is required"
}
```

### 401 Unauthorized

Example:

```json
{
  "status": "error",
  "error": "Unauthorized. Valid X-API-Key is required for M2M."
}
```

### 500 Server Error

Example shape:

```json
{
  "status": "error",
  "error": "<runtime error message>"
}
```

---

## 6. Semantic labels

Current operational labels used by the analysis flow:

- **GREEN** — fillers, discourse markers, transitions
- **BLUE** — sentence frames / reusable communication structures
- **RED** — idiomatic or figurative expression
- **PINK** — key terms / lexical concepts

Ohm values for these labels are configurable.

---

## 7. cURL example

```bash
curl -X POST "https://YOUR_SHARED_API_ORIGIN/api/analyze-ohm" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_M2M_API_KEY" \
  -H "X-Requested-With: XMLHttpRequest" \
  -d '{
    "transcript": "Chào mừng bạn đến với hệ thống phân tích Ohm."
  }'
```

---

## 8. Webhook mode

When `webhookUrl` is included:

1. the API acknowledges processing immediately
2. analysis runs asynchronously
3. result is sent as a `POST` request to the provided webhook URL

### Example webhook success payload

```json
{
  "status": "success",
  "data": {
    "transcriptRaw": "...",
    "transcriptNormalized": "...",
    "chunks": [],
    "formula": "...",
    "totalOhm": 0
  }
}
```

### Example webhook error payload

```json
{
  "status": "error",
  "error": "<runtime error message>"
}
```

---

## 9. Integration tips

### Timeouts

Analysis may take several seconds depending on provider/model latency.

Recommended:

- set a timeout appropriate for AI-backed processing
- prefer webhook mode for long-running server workflows

### Encoding

Use UTF-8 consistently for Vietnamese input.

### Gateway behavior

If your infrastructure returns HTML/redirects instead of JSON:

- verify the request host/origin
- include `Accept: application/json`
- include `X-Requested-With: XMLHttpRequest`
- verify `GET /api/ping` first

---

## 10. Health check example

```bash
curl -X GET "https://YOUR_SHARED_API_ORIGIN/api/ping" \
  -H "Accept: application/json"
```

Example response:

```json
{
  "status": "ok",
  "timestamp": "2026-04-30T00:00:00.000Z",
  "message": "M2M API Gateway is active",
  "environment": "production"
}
```

---

## 11. Contract summary

Use the M2M API when you need:

- structured semantic chunk extraction
- configurable Ohm scoring
- optional async webhook delivery
- external integration without driving the full web app
