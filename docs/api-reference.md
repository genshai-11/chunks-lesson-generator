# CHUNKS CVR — M2M API Reference

## Base URLs

| Environment | URL | Notes |
|---|---|---|
| Local dev | `http://localhost:3000` | Run `npm run dev` (`tsx server.ts`) |
| Production API | `https://chunks-cvr-api-781691010426.asia-southeast1.run.app` | Google Cloud Run |
| Production frontend | `https://chunks-cvr.web.app` | Firebase Hosting — SPA only, no API |

> The M2M API endpoints are served by the Cloud Run service. The Firebase Hosting URL only serves the React frontend.

---

## Authentication

Every protected endpoint requires two headers:

| Header | Value |
|---|---|
| `X-API-Key` | Your M2M key (env `M2M_API_KEY`; default `m2m_CHUNK_ANALYZER_SECURE_2026`) |
| `X-Requested-With` | `XMLHttpRequest` |

Missing or wrong key → `401 Unauthorized`.

---

## GET /api/ping

Health check. No auth required.

**Response `200`**
```json
{
  "status": "ok",
  "timestamp": "2026-05-23T00:00:00.000Z",
  "message": "M2M API Gateway is active",
  "environment": "development"
}
```

---

## POST /api/measure-cvr

Measures the Comprehensible Vocabulary Rate (CVR) of a Vietnamese transcript.

The server auto-fetches resources and AI settings from Supabase if you don't supply them inline.

### Request body

```jsonc
{
  "transcript": "Thành thật mà nói, hạ đường huyết không phải chuyện nhỏ.",  // required
  "resources": [ /* Resource[] — optional, server fetches if omitted */ ],
  "tcCorrections": [                              // optional manual TC overrides
    {
      "sentence_fragment": "hạ đường huyết",
      "resource_name": "hạ đường huyết",
      "color": "Pink",
      "ohm": 3
    }
  ],
  "settings": { /* AISettings — optional */ }
}
```

**Resource shape**
```jsonc
{
  "id": "r1",
  "name": "hạ đường huyết",
  "color": "Pink",       // "Green" | "Blue" | "Pink" | "Red"
  "ohm": 3,
  "userId": "user123",
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

### Response `200`

```jsonc
{
  "status": "success",
  "data": {
    "transcriptRaw": "Thành thật mà nói...",
    "transcriptNormalized": "thành thật mà nói...",
    "predictedCVR": 27,                 // integer ≥ 1
    "formula": "TC × LC × TL",
    "calculationString": "3 (TC) × 3 (LC) × 3.0 (TL) = 27",
    "lcBreakdown": {
      "sentenceCount": 1,
      "wordCount": 9,
      "lengthBand": "Short",
      "lcValue": 3,
      "reasoning": "..."
    },
    "tcBreakdown": {
      "matchedResources": [ /* Resource[] actually found in transcript */ ],
      "candidateResources": [ /* Resource[] considered but not confirmed */ ],
      "confirmedTC": 3,
      "estimatedTC": 3,
      "calculation": "..."
    },
    "tlBreakdown": {
      "band": "Daily Life",
      "tlValue": 3.0,
      "confidence": 0.9,
      "reasoning": "..."
    }
  }
}
```

**CVR floor rule:** if no resources are matched (`TC = 0`), `predictedCVR` is always `1`.

### Errors

| Status | Condition |
|---|---|
| `400` | `transcript` missing or not a string |
| `500` | AI provider error or internal failure |

### Examples

```bash
# Minimal — server fetches resources from Supabase
curl -X POST http://localhost:3000/api/measure-cvr \
  -H "Content-Type: application/json" \
  -H "X-API-Key: m2m_CHUNK_ANALYZER_SECURE_2026" \
  -H "X-Requested-With: XMLHttpRequest" \
  -d '{"transcript": "Thành thật mà nói, hạ đường huyết không phải chuyện nhỏ."}'

# With inline resources
curl -X POST http://localhost:3000/api/measure-cvr \
  -H "Content-Type: application/json" \
  -H "X-API-Key: m2m_CHUNK_ANALYZER_SECURE_2026" \
  -H "X-Requested-With: XMLHttpRequest" \
  -d '{
    "transcript": "Thành thật mà nói, hạ đường huyết không phải chuyện nhỏ.",
    "resources": [
      {"id":"r1","name":"hạ đường huyết","color":"Pink","ohm":3,"userId":"u","createdAt":"2026-01-01T00:00:00.000Z"},
      {"id":"r2","name":"thành thật mà nói","color":"Green","ohm":5,"userId":"u","createdAt":"2026-01-01T00:00:00.000Z"}
    ]
  }'
```

---

## POST /api/chunk-generate

Generates a single bilingual (Vietnamese + English) sentence from a specific set of resources and CHUNKS algorithm parameters.

Use this when you already know exactly which resources to include and have pre-calculated `R`, `I`, `U` values.

### Request body

```jsonc
{
  "resources": [ /* Resource[] — required, must be non-empty */ ],
  "rTotal": 17,              // total Resistance (sum of resource Ohms)
  "iValue": 1.0,             // Current / MSE complexity multiplier
  "uTotal": 17,              // Voltage = I × R
  "theme": "Daily life",     // optional — omit to let AI infer from resources
  "topicLevel": 1.2,         // optional — 1.0–2.0, default 1.0
  "sentenceLength": "Short", // optional — "Very Short"|"Short"|"Medium"|"Long"
  "settings": { /* AISettings — optional */ }
}
```

**`topicLevel` bands**

| Range | Register |
|---|---|
| 1.0–1.2 | Daily life, casual (A1–A2) |
| 1.3–1.7 | Social/professional/academic (B1–B2) |
| 1.8–2.0 | Industry/specialist/intellectual (B2–C1) |

**`sentenceLength` word targets** (Vietnamese word count)

| Value | Sentences | Words |
|---|---|---|
| `Very Short` | 1 | ≤ 15 |
| `Short` | 2 | ≤ 30 |
| `Medium` | 3 | ≤ 60 |
| `Long` | 5 | ≤ 100 |

### Response `200`

```jsonc
{
  "status": "success",
  "data": {
    "vieSentence": "Thành thật mà nói, hạ đường huyết khiến anh ấy mệt mỏi.",
    "engSentence": "Honestly, hypoglycemia was wearing him out.",
    "category": "Health & Wellness"
  }
}
```

### Errors

| Status | Condition |
|---|---|
| `400` | `resources` missing or empty array |
| `500` | AI provider error |

### Example

```bash
curl -X POST http://localhost:3000/api/chunk-generate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: m2m_CHUNK_ANALYZER_SECURE_2026" \
  -H "X-Requested-With: XMLHttpRequest" \
  -d '{
    "resources": [
      {"id":"r1","name":"hạ đường huyết","color":"Pink","ohm":3,"userId":"u","createdAt":"2026-01-01T00:00:00.000Z"},
      {"id":"r2","name":"mật ngọt chết ruồi","color":"Red","ohm":9,"userId":"u","createdAt":"2026-01-01T00:00:00.000Z"}
    ],
    "rTotal": 12,
    "iValue": 1.0,
    "uTotal": 12,
    "theme": "Health",
    "topicLevel": 1.2,
    "sentenceLength": "Short"
  }'
```

---

## POST /api/chunk-generate/batch

Generates `N` chunks automatically. The server selects which resources to use, calculates R/I/U, and calls the AI for each chunk. Resources and settings are fetched from Supabase if not supplied inline.

Use this for bulk lesson generation or seeding a queue.

### Request body

```jsonc
{
  "quantity": 3,                         // required — number of chunks to generate
  "sentenceLength": "Short",             // required — "Very Short"|"Short"|"Medium"|"Long"
  "theme": "Health & Daily Life",        // optional — omit to let AI vary per chunk
  "topicLevel": 1.3,                     // optional — 1.0–2.0
  "targetU": 20,                         // optional — target Voltage (difficulty), default 10
  "colorPreferences": ["Pink", "Red"],   // optional — filter resources by color
  "availableResources": [ /* Resource[] — optional, server fetches if omitted */ ],
  "settings": { /* AISettings — optional */ }
}
```

**`colorPreferences`** accepts any subset of `"Green"`, `"Blue"`, `"Pink"`, `"Red"`. An empty array (or omitted) means all colors are eligible.

### Response `200`

```jsonc
{
  "status": "success",
  "data": [
    {
      "vieSentence": "Mật ngọt chết ruồi, anh ấy cũng bị hạ đường huyết.",
      "engSentence": "Sweet things can be a trap — he ended up with low blood sugar too.",
      "category": "Health",
      "resourcesUsed": [ /* Resource[] picked for this chunk */ ],
      "rTotal": 12,
      "iValue": 1.0,
      "uTotal": 12,
      "difficultyLabel": "Medium",
      "audioUrl": null
    }
    // … quantity items
  ]
}
```

### Errors

| Status | Condition |
|---|---|
| `400` | `quantity` or `sentenceLength` missing |
| `500` | AI provider error |

### Example

```bash
curl -X POST http://localhost:3000/api/chunk-generate/batch \
  -H "Content-Type: application/json" \
  -H "X-API-Key: m2m_CHUNK_ANALYZER_SECURE_2026" \
  -H "X-Requested-With: XMLHttpRequest" \
  -d '{
    "theme": "Health & Daily Life",
    "topicLevel": 1.3,
    "targetU": 20,
    "quantity": 3,
    "sentenceLength": "Short",
    "colorPreferences": ["Pink", "Red"]
  }'
```

---

## Common error envelope

All errors return the same shape:

```json
{
  "status": "error",
  "error": "human-readable message"
}
```

---

## Quick reference

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /api/ping` | none | Health check |
| `POST /api/measure-cvr` | M2M key | Score a Vietnamese transcript |
| `POST /api/chunk-generate` | M2M key | Generate 1 chunk from explicit resources |
| `POST /api/chunk-generate/batch` | M2M key | Generate N chunks automatically |
