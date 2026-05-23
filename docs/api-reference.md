# CHUNKS CVR — M2M API Reference

## Base URLs

| Environment | URL | Notes |
|---|---|---|
| Local dev | `http://localhost:3000` | `npm run dev` |
| Production API | `https://chunks-cvr-api-781691010426.asia-southeast1.run.app` | Google Cloud Run |
| Production frontend | `https://chunks-cvr.web.app` | Firebase Hosting — SPA only, no API |

> The M2M API endpoints are served by the Cloud Run service only. The Firebase Hosting URL serves the React frontend and has no `/api/*` routes.

---

## Authentication

Every protected endpoint requires two headers:

| Header | Value |
|---|---|
| `X-API-Key` | Your M2M key (`M2M_API_KEY` env var; default `m2m_CHUNK_ANALYZER_SECURE_2026`) |
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
  "environment": "production"
}
```

---

## POST /api/measure-cvr

Scores a Vietnamese transcript using the CVR formula: `CVR = TC × LC × TL`.

If `resources` or `settings` are omitted, the server fetches them from Supabase automatically.

### Request body

```jsonc
{
  "transcript": "Thành thật mà nói, hạ đường huyết không phải chuyện nhỏ.", // required
  "resources": [ /* Resource[] — optional, server fetches if omitted */ ],
  "tcCorrections": [          // optional — manual TC overrides for known fragments
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
  "color": "Pink",   // "Green" | "Blue" | "Pink" | "Red"
  "ohm": 3,          // Ohm value for this color
  "userId": "user123",
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

**Ohm defaults by color**

| Color | Ohm | Category |
|---|---|---|
| Green | 5 | Discourse markers / fillers |
| Blue | 7 | Sentence frames / grammatical skeletons |
| Pink | 3 | Key concepts / technical terms (B1+) |
| Red | 9 | Idioms / metaphors / nuanced expressions |

### Response `200`

```jsonc
{
  "status": "success",
  "data": {
    "transcriptRaw": "Thành thật mà nói, hạ đường huyết không phải chuyện nhỏ.",
    "transcriptNormalized": "thành thật mà nói hạ đường huyết không phải chuyện nhỏ",
    "predictedCVR": 10,            // integer ≥ 1 (floor = 1 when confirmedTC = 0)
    "formula": "Estimated TC * LC * TL",
    "calculationString": "8 (TC) × 1 (LC) × 1.2 (TL) = 10",

    "lcBreakdown": {
      "sentenceCount": 1,
      "wordCount": 10,
      "lengthBand": "Very Short",  // "Very Short" | "Short" | "Medium" | "Long"
      "lcValue": 1,                // 1 | 1.5 | 2 | 2.5
      "reasoning": "..."
    },

    "tcBreakdown": {
      // Items matched from your resource library (exact span match in transcript)
      "matchedResources": [
        {
          "text": "thành thật mà nói",  // phrase as found in transcript
          "color": "Green",
          "ohm": 5,
          "matchStart": 0,
          "matchEnd": 17,
          "specificity": 4.0
        }
      ],
      // Additional vocabulary identified by AI as potential resources (not in library)
      "candidateResources": [
        {
          "text": "hạ đường huyết",
          "color": "Pink",
          "ohm": 3,
          "confidence": 0.9,
          "reasoning": "..."
        }
      ],
      "confirmedTC": 5,    // Ohm sum of matched resources within slot cap
      "estimatedTC": 8,    // confirmedTC + candidate Ohms (capped by sentenceLength slots)
      "calculation": "5 (matched) + 3 (candidate) = 8 (Capped at 2 slots for Very Short, fill: highest-ohm)"
    },

    "tlBreakdown": {
      // Band strings: "TL 1.0-1.2 Daily life / casual routine"
      //               "TL 1.3-1.7 Social/Professional/Nuanced domain"
      //               "TL 1.8-2.0 Specialized professional/academic"
      "band": "TL 1.0-1.2 Daily life / casual routine",
      "tlValue": 1.2,      // float, range 1.0–2.0
      "confidence": 0.9,
      "reasoning": "..."
    }
  }
}
```

**TC slot cap by sentence length**

| Band | Max slots |
|---|---|
| Very Short | 2 |
| Short | 3 |
| Medium | 4 |
| Long | 5 |

**LC multipliers**

| Band | Words | LC value |
|---|---|---|
| Very Short | ≤ 18 | 1.0 |
| Short | ≤ 30 | 1.5 |
| Medium | ≤ 60 | 2.0 |
| Long | > 60 | 2.5 |

**TL axis — Topic + Vocabulary, `TL = max(T, V)`**

| TL | Meaning |
|---|---|
| 1.0–1.2 | Daily life, casual (A1–A2) |
| 1.3–1.7 | Social / applied professional (B1–B2) |
| 1.8–2.0 | Academic, policy, specialist research (C1–C2) |

### Errors

| Status | Condition |
|---|---|
| `400` | `transcript` missing or not a string |
| `500` | AI provider error or internal failure |

### Examples

```bash
BASE=https://chunks-cvr-api-781691010426.asia-southeast1.run.app
KEY=m2m_CHUNK_ANALYZER_SECURE_2026

# Minimal — server fetches resources from Supabase
curl -X POST $BASE/api/measure-cvr \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $KEY" \
  -H "X-Requested-With: XMLHttpRequest" \
  -d '{"transcript": "Thành thật mà nói, hạ đường huyết không phải chuyện nhỏ."}'

# With inline resources (faster, no Supabase round-trip)
curl -X POST $BASE/api/measure-cvr \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $KEY" \
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

Generates one bilingual sentence (Vietnamese + English) from an explicit set of resources and pre-calculated CHUNKS algorithm values (`R`, `I`, `U`).

Use this when you already know which resources to include.

### Request body

```jsonc
{
  "resources": [ /* Resource[] — required, non-empty */ ],
  "rTotal": 12,              // total Resistance = sum of resource Ohms
  "iValue": 1.0,             // Current / MSE complexity multiplier
  "uTotal": 12,              // Voltage = I × R
  "theme": "Health",         // optional — omit to let AI infer from resources
  "topicLevel": 1.2,         // optional — 1.0–2.0, controls vocabulary register
  "sentenceLength": "Short", // optional — "Very Short"|"Short"|"Medium"|"Long"
  "settings": { /* AISettings — optional */ }
}
```

**`topicLevel` register guide**

| Range | Register | CEFR |
|---|---|---|
| 1.0–1.2 | Daily life, casual | A1–A2 |
| 1.3–1.7 | Social / professional / academic | B1–B2 |
| 1.8–2.0 | Specialist / research / policy | C1–C2 |

**`sentenceLength` targets** (measured in Vietnamese words)

| Value | Sentences | Max words |
|---|---|---|
| `Very Short` | 1 | 18 |
| `Short` | 2 | 30 |
| `Medium` | 3 | 60 |
| `Long` | 5 | 100 |

### Response `200`

```jsonc
{
  "status": "success",
  "data": {
    "vieSentence": "Thành thật mà nói, hạ đường huyết khiến anh ấy kiệt sức sau buổi tập.",
    "engSentence": "Honestly, hypoglycemia left him completely drained after the workout.",
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
BASE=https://chunks-cvr-api-781691010426.asia-southeast1.run.app
KEY=m2m_CHUNK_ANALYZER_SECURE_2026

curl -X POST $BASE/api/chunk-generate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $KEY" \
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

Generates `N` chunks automatically. The server picks resources, calculates R/I/U, and calls the AI for each chunk. Resources and settings are fetched from Supabase if not supplied inline.

### Request body

```jsonc
{
  "quantity": 3,                        // required — number of chunks
  "sentenceLength": "Short",            // required — "Very Short"|"Short"|"Medium"|"Long"
  "theme": "Health & Daily Life",       // optional — omit to vary per chunk
  "topicLevel": 1.3,                    // optional — 1.0–2.0
  "targetU": 20,                        // optional — target Voltage (difficulty), default 10
  "colorPreferences": ["Pink", "Red"],  // optional — restrict resource colors; [] = all colors
  "availableResources": [ /* Resource[] — optional, server fetches if omitted */ ],
  "settings": { /* AISettings — optional */ }
}
```

### Response `200`

```jsonc
{
  "status": "success",
  "data": [
    {
      "vieSentence": "Mật ngọt chết ruồi, anh ấy cũng bị hạ đường huyết sau bữa tiệc.",
      "engSentence": "Sweet things can be a trap — he ended up with low blood sugar after the party.",
      "category": "Health",
      "resourcesUsed": [ /* Resource[] selected for this chunk */ ],
      "rTotal": 12,
      "iValue": 1.0,
      "uTotal": 12,
      "difficultyLabel": "Short",
      "audioUrl": null
    }
    // … one item per quantity requested
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
BASE=https://chunks-cvr-api-781691010426.asia-southeast1.run.app
KEY=m2m_CHUNK_ANALYZER_SECURE_2026

curl -X POST $BASE/api/chunk-generate/batch \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $KEY" \
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
| `POST /api/measure-cvr` | M2M key | Score a Vietnamese transcript (CVR = TC × LC × TL) |
| `POST /api/chunk-generate` | M2M key | Generate 1 bilingual chunk from explicit resources |
| `POST /api/chunk-generate/batch` | M2M key | Generate N chunks automatically |
